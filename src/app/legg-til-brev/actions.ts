"use server";
import { brevforklaring } from "@/lib/brevforklaring";
import { kontrollerBrevfunn } from "@/lib/brevkontroll";
import { erLiktBrev } from "@/lib/brevduplikat";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAK_UTFALL, type FristForslag, type SakUtfall } from "@/lib/types";
import { beregnFrist, foreslaStadium, type BrevType } from "@/lib/gjeld";
import { utfallAvslutter } from "@/lib/utfall";
import { lagreBrevFeilmelding } from "@/lib/saksstatus";
import { AI_MODELL, AI_MODELL_RASK } from "@/lib/ai";
import { forsokId, skalBelastes } from "@/lib/kvote";
import { startKvote, type Kvotevakt } from "@/lib/kvote-server";
import { maskerAlleStrenger, maskerFodselsnummer } from "@/lib/maskering";
import { logg } from "@/lib/logg";
import { tolkKr, tellOrd, kuttTilMaks } from "@/lib/format";
import {
  sjekkKostnader,
  type Kostnadslinje,
  type GebyrsjekkResultat,
} from "@/lib/gebyr";
import { erAlvorligSak } from "@/lib/alvorsgrense";
import { fristKildeForDato, type FristSammenligning } from "@/lib/frist";
import { kontrollerSum } from "@/lib/sumkontroll";
import { validerBrevfiler } from "@/lib/brevfil";
import {
  finnHovedstolAvvik,
  type HovedstolBrevInput,
} from "@/lib/hovedstol-konsistens";
import {
  lesBrevTekst,
  lesBrevBilder,
  type Analyse,
  type Bilde,
} from "@/lib/brevanalyse";
import type { AiFeil } from "@/lib/ai-svar";

/**
 * Hva brukeren får vite når lesingen ikke ga et brukbart svar. Ingenting lagres
 * i noen av tilfellene, og meldingen sier hvorfor i stedet for å skylde på bildet.
 */
const LESEFEIL: Record<AiFeil, string> = {
  avbrutt:
    "Brevet var for langt til å bli lest ferdig. Ingenting er lagret. Prøv med færre sider, eller lim inn teksten fra siden med kravet.",
  ugyldig_struktur:
    "Lesingen ga et ufullstendig resultat. Ingenting er lagret. Prøv igjen.",
  tidsavbrudd:
    "Lesingen tok for lang tid. Ingenting er lagret. Prøv igjen, gjerne med færre sider.",
  nettverk: "Fikk ikke kontakt med lesetjenesten. Ingenting er lagret. Prøv igjen om litt.",
  tjeneste: "Lesetjenesten er travel akkurat nå. Ingenting er lagret. Prøv igjen om litt.",
  ukjent: "Noe gikk galt under lesingen. Ingenting er lagret. Prøv igjen om litt.",
};

// NB: ingen re-eksport av typer herfra. En «use server»-fil gjør hver eksport
// om til en server action-referanse — `export type { Bilde }` ble kompilert
// til en kjøretidsreferanse som ikke finnes, og HELE modulen feilet ved
// lasting («ReferenceError: Bilde is not defined»). Klienten importerer
// typen direkte fra @/lib/brevanalyse.

/**
 * Et eksisterende krav brevet KAN høre til — et forslag brukeren bekrefter,
 * ikke en automatisk sammenslåing. `grunn` sier hvor sikkert treffet er:
 * "saksnummer" (sterkt) eller "avsender" (svakt).
 */
export type KravForslag = {
  id: string;
  navn: string;
  grunn: "saksnummer" | "avsender";
};

export type AnalyseResultat =
  | {
      ok: true;
      analyse: Analyse;
      /** Teksten som lagres som original_tekst (innlimt eller ekstrahert). */
      original_tekst: string;
      /** Frist beregnet deterministisk av kode (kilde='beregnet'), om noen. */
      beregnetFrist: { tittel: string; forfallsdato: string } | null;
      /** Mulig eksisterende krav (forslag, ikke automatisk valgt). */
      kravForslag: KravForslag | null;
      /** Deterministisk gebyrsjekk (kode beslutter). Null når ingen kostnadslinjer. */
      gebyrsjekk: GebyrsjekkResultat | null;
      /** erAlvorligSak() kjørt på brevteksten (kode beslutter, ikke AI). */
      alvorlig: boolean;
    }
  | { ok: false; feil: string };

// Kodehåndhevelse av analyse-kort-ordrens §2.2-tak (kalibrert etter første
// runde — 70 ord viste seg å tvinge modellen til å ofre innhold; se
// PROSJEKT_STATUS). «AI tolker, kode beslutter» — også for lengde/antall.
const MAKS_STEG = 3;
const MAKS_STEG_ORD = 14;
// Kode beslutter: beregn frist av regel + match mot eksisterende krav, kutt
// steg-lista og korriger en forklaring utenfor ordtaket. Deles mellom tekst-
// og bildeanalysen. Muterer analyse.forklaring/foreslatte_steg direkte —
// kalleren leser de samme (nå rettede) feltene fra sitt eget objekt etterpå.
async function etterbehandle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analyse: Analyse,
  originalTekst: string,
): Promise<{
  beregnetFrist: { tittel: string; forfallsdato: string } | null;
  kravForslag: KravForslag | null;
  gebyrsjekk: GebyrsjekkResultat | null;
  alvorlig: boolean;
  /** Antall ekstra AI-kall (omskriving av forklaringen). */
  ekstraKall: number;
}> {
  const ekstraKall = 0;
  // Steg: maks 3, prioritert rekkefølge → trygt å kutte uten regenerering.
  analyse.foreslatte_steg = kuttTilMaks(analyse.foreslatte_steg, MAKS_STEG);
  // Bare antallet logges, aldri teksten (den er avledet av brevet).
  const forLange = analyse.foreslatte_steg.filter((s) => tellOrd(s) > MAKS_STEG_ORD).length;
  if (forLange > 0) logg("warn", "legg-til-brev", "steg_for_langt", { antall: forLange, maks: MAKS_STEG_ORD });

  analyse.forklaring = brevforklaring({ ...analyse, belop: tolkKr(analyse.belop) });

  const beregnet =
    analyse.brevdato && analyse.brevtype
      ? beregnFrist(analyse.brevtype, analyse.brevdato)
      : null;
  const beregnetFrist = beregnet
    ? { tittel: beregnet.tittel, forfallsdato: beregnet.forfallsdato }
    : null;

  // Gebyrsjekk (kode beslutter). Salærtrinnene defineres av opprinnelig
  // hovedstol; bruk den når AI-en fant den eksplisitt, og fall tilbake til
  // totalbeløpet (konservativt) når hovedstol mangler.
  const hovedstol = tolkKr(analyse.hovedstol) ?? tolkKr(analyse.belop);
  const gebyrsjekk =
    analyse.kostnadslinjer.length > 0
      ? sjekkKostnader(analyse.kostnadslinjer, hovedstol, analyse.brevdato || null)
      : null;

  // Match mot eksisterende krav er et FORSLAG brukeren bekrefter — aldri en
  // automatisk sammenslåing. Saksnummer er et sterkt treff; avsender alene er
  // svakt (to ulike gjeld fra samme inkassoselskap ville ellers slått seg
  // sammen). Brukeren avgjør i steg 3.
  const { data: saker } = await supabase
    .from("saker")
    .select("id, kreditor, tittel, saksnummer");
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  const liste = saker ?? [];
  const navn = (s: { kreditor: string | null; tittel: string }) =>
    s.kreditor ?? s.tittel;

  let kravForslag: KravForslag | null = null;
  if (analyse.saksnummer) {
    const t = liste.find((s) => norm(s.saksnummer) === norm(analyse.saksnummer));
    if (t) kravForslag = { id: t.id, navn: navn(t), grunn: "saksnummer" };
  }
  if (!kravForslag && analyse.avsender) {
    const t = liste.find((s) => norm(s.kreditor) === norm(analyse.avsender));
    if (t) kravForslag = { id: t.id, navn: navn(t), grunn: "avsender" };
  }

  // Alvorsgrense (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §B.3): rent tekstsøk på
  // brevets EGEN (allerede maskerte) tekst — ingen AI-dom. Lagres som
  // brev.alvorlig; sannheten ved visning, rekalkuleres aldri.
  const alvorlig = erAlvorligSak(originalTekst);

  return { beregnetFrist, kravForslag, gebyrsjekk, alvorlig, ekstraKall };
}

/**
 * Avslutter kvoten for en analyse. En operasjonell feil (tidsavbrudd, nettverk,
 * travel tjeneste) belaster ikke brukeren. Et svar, også et ubrukelig, gjør det:
 * modellen har lest dokumentet.
 */
async function avsluttAnalyse(
  vakt: Kvotevakt,
  modell: string,
  lest: { ok: boolean; feil?: AiFeil; bruk: { inn: number; ut: number } | null },
  ekstraKall = 0,
) {
  await vakt.avslutt(skalBelastes(lest.ok ? null : (lest.feil ?? "ukjent")), {
    modell,
    inn_tokens: lest.bruk?.inn,
    ut_tokens: lest.bruk?.ut,
    ai_kall: 1 + ekstraKall,
    feil: lest.ok ? undefined : lest.feil,
  });
}

export async function analyserBrevTekst(
  tekst: string,
): Promise<AnalyseResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const rensket = tekst.trim();
  if (rensket.length < 10)
    return { ok: false, feil: "Lim inn teksten fra brevet først." };
  if (rensket.length > 20000)
    return { ok: false, feil: "Teksten er for lang. Lim inn ett brev av gangen." };
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };

  // Kvoten håndheves på serveren. Samme tekst på nytt belastes ikke to ganger.
  const kvote = await startKvote("dokumentanalyse", user.id, forsokId("dokumentanalyse", user.id, rensket));
  if (!kvote.ok) return { ok: false, feil: kvote.melding };

  const lest = await lesBrevTekst(new Anthropic(), maskerFodselsnummer(rensket));
  if (!lest.ok) {
    await avsluttAnalyse(kvote.vakt, AI_MODELL_RASK, lest);
    return { ok: false, feil: LESEFEIL[lest.feil] };
  }
  const analyse: Analyse = lest.data;

  // Masker fødselsnumre før teksten lagres/vises videre (AI-kallet over kjørte
  // på originalen — det er den uunngåelige første sendingen). Alvorsgrensen
  // sjekkes mot samme (maskerte) tekst som lagres og vises senere.
  const original_tekst = maskerFodselsnummer(rensket);
  let etter: Awaited<ReturnType<typeof etterbehandle>> | undefined;
  try {
    etter = await etterbehandle(supabase, analyse, original_tekst);
  } finally {
    // Modellen har lest brevet: forsøket er brukt, også om etterbehandlingen feiler.
    await avsluttAnalyse(kvote.vakt, AI_MODELL_RASK, lest, etter?.ekstraKall ?? 0);
  }
  const { beregnetFrist, kravForslag, gebyrsjekk, alvorlig } = etter;
  return {
    ok: true,
    analyse,
    original_tekst,
    beregnetFrist,
    kravForslag,
    gebyrsjekk,
    alvorlig,
  };
}

export async function analyserBrevBilder(
  bilder: Bilde[],
): Promise<AnalyseResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Samme regler som klienten: et direkte kall skal ikke omgå grensene.
  const filFeil = validerBrevfiler(bilder);
  if (filFeil) return { ok: false, feil: filFeil };
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, feil: "AI er ikke konfigurert (mangler API-nøkkel)." };

  const kvote = await startKvote(
    "dokumentanalyse",
    user.id,
    forsokId("dokumentanalyse", user.id, ...bilder.map((b) => b.data)),
  );
  if (!kvote.ok) return { ok: false, feil: kvote.melding };

  const lest = await lesBrevBilder(new Anthropic(), bilder);
  if (!lest.ok) {
    await avsluttAnalyse(kvote.vakt, AI_MODELL, lest);
    return { ok: false, feil: LESEFEIL[lest.feil] };
  }
  const analyse: Analyse & { ekstrahert_tekst: string } = lest.data;

  const { ekstrahert_tekst, ...rest } = analyse;
  const original_tekst = maskerFodselsnummer(ekstrahert_tekst);
  let etter: Awaited<ReturnType<typeof etterbehandle>> | undefined;
  try {
    etter = await etterbehandle(supabase, rest, original_tekst);
  } finally {
    await avsluttAnalyse(kvote.vakt, AI_MODELL, lest, etter?.ekstraKall ?? 0);
  }
  const { beregnetFrist, kravForslag, gebyrsjekk, alvorlig } = etter;
  return {
    ok: true,
    analyse: rest,
    original_tekst,
    beregnetFrist,
    kravForslag,
    gebyrsjekk,
    alvorlig,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LagreBrevInput = {
  krav:
    | { modus: "ny"; kreditor: string }
    | { modus: "eksisterende"; sakId: string };
  avsender: string;
  brevtype: BrevType | null;
  brevdato: string; // "" hvis ukjent
  belop: number | null;
  saksnummer: string;
  avsender_epost: string;
  original_tekst: string;
  forklaring: string;
  foreslatte_steg: string[]; // valgte steg
  valgteFrister: FristForslag[]; // valgte frister med kilde
  /** Bekreftet utfall når brevet er et svar på en sak i venter_pa_svar. */
  utfall: SakUtfall | null;
  /** Kostnadslinjene AI-en fant (rådata). Null/tom når ingen. */
  kostnadslinjer: Kostnadslinje[] | null;
  /** Opprinnelig hovedstol (salærgrunnlag). Null → totalbeløp brukes. */
  hovedstol: number | null;
  /** sammenlignFrist()-resultatet (samme verdi som vist i steg 3). Null når
   *  verken eksplisitt eller beregnet frist finnes for brevtypen. */
  fristfunn: FristSammenligning | null;
  /** erAlvorligSak() kjørt av etterbehandle() ved analyse. */
  alvorlig: boolean;
  /** Brukeren har krysset av «Ja, dette stemmer med brevet» (§A.2). Uten
   *  den avvises lagringen — også ved direkte kall (guardrail 4). */
  bekreftet: true;
  fristIBrevet: { tittel: string; forfallsdato: string } | null;
  /** «Det stemmer likevel» ved sumavvik (delbetaling, renter o.l.). */
  sumStemmerLikevel: boolean;
  /** Aktive frister på saken som brukeren sier at dette brevet erstatter. */
  erstatterFrister: string[];
  /** Brukeren har bekreftet at et utfall som avslutter saken skal brukes. */
  avslutningBekreftet: boolean;
  /** En avsluttet sak åpnes bare når brukeren eksplisitt har valgt det. */
  gjenapne: boolean;
  /** Sakens sist_endret da siden ble lest. Endret siden? Da avvises lagringen. */
  forventetSistEndret: string | null;
  /** Brukeren vil bruke tallene fra et brev som ikke er det nyeste (A2). */
  oppdaterSak: boolean;
  /** Samme nøkkel for samme lagringsforsøk. Et nytt forsøk lagrer ikke på nytt (A3). */
  lagringsnokkel: string;
};

export type LagreBrevResultat =
  | { ok: true; sakId: string; brevId: string }
  | { ok: false; feil: string; kontroll?: { alvorlig: boolean; fristfunn: FristSammenligning | null } };

export async function lagreBrev(
  input: LagreBrevInput,
): Promise<LagreBrevResultat> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Bekreftelsessteget kan ikke hoppes over (guardrail 4): uten eksplisitt
  // bekreftelse lagres ingenting, heller ikke ved et direkte kall.
  if (input.bekreftet !== true)
    return { ok: false, feil: "Bekreft tallene fra brevet før du lagrer." };

  // Uten gyldig nøkkel kan et nytt forsøk lage et brev til, så det avvises.
  if (typeof input.lagringsnokkel !== "string" || !UUID.test(input.lagringsnokkel))
    return { ok: false, feil: "Last inn siden på nytt og prøv igjen." };

  // Utfall: bare kjente verdier, og et utfall som avslutter saken krever
  // eksplisitt bekreftelse, også ved direkte kall.
  if (input.utfall !== null && !(SAK_UTFALL as readonly string[]).includes(input.utfall))
    return { ok: false, feil: "Ukjent utfall." };
  if (input.utfall && utfallAvslutter(input.utfall) && input.avslutningBekreftet !== true)
    return { ok: false, feil: "Bekreft at saken skal avsluttes." };

  const linjer = input.kostnadslinjer ?? [];
  const kontroll = kontrollerBrevfunn(input);
  if (!kontroll.ok) return kontroll;
  if (kontroll.alvorlig !== input.alvorlig || JSON.stringify(kontroll.fristfunn) !== JSON.stringify(input.fristfunn))
    return { ok: false, feil: "Serverkontrollen avviker fra det som ble vist. Ingenting er lagret. Kontroller oppdatert alvorlighetsvarsel og frist før du bekrefter på nytt.", kontroll };

  // Sumkontrollen regnes på nytt fra det brukeren bekreftet (kode beslutter).
  // Går tallene ikke opp, må brukeren ha krysset av «stemmer likevel».
  const sumkontroll = kontrollerSum(input.belop, input.hovedstol, linjer);
  if (sumkontroll.status === "avvik" && input.sumStemmerLikevel !== true)
    return {
      ok: false,
      feil: "Tallene går ikke opp. Rett beløpene, eller kryss av for at det stemmer likevel.",
    };

  const stadium = foreslaStadium(input.brevtype ?? "annet");

  // Rekalkuler gebyrsjekken fra de endelige verdiene brukeren bekreftet (kode
  // beslutter). Retter brukeren et feillest beløp, følger vurderingen med.
  // Lagret jsonb er sannheten for visning senere — ikke rekalkuler ved lesing.
  let gebyrsjekk: (GebyrsjekkResultat & { sumkontroll?: unknown }) | null =
    linjer.length > 0
      ? sjekkKostnader(linjer, input.hovedstol ?? input.belop, input.brevdato || null)
      : null;
  // Et bekreftet sumavvik lagres i det eksisterende gebyrsjekk-jsonb-objektet
  // (§A.3, ingen ny kolonne) — kun for senere feilsøking, vises ikke i saken.
  // Uten kostnadslinjer lages et tomt gebyrsjekk-objekt til formålet.
  if (sumkontroll.status === "avvik") {
    gebyrsjekk = {
      ...(gebyrsjekk ?? sjekkKostnader([], input.hovedstol, input.brevdato || null)),
      sumkontroll: { ...sumkontroll, bekreftetLikevel: true },
    };
  }

  const valgteFrister = input.valgteFrister.map((f) => ({
    ...f, kilde: fristKildeForDato(f.kilde, f.forfallsdato ?? "", kontroll.fristfunn),
  }));
  const nyeFrister = valgteFrister.filter((f) => f.forfallsdato);
  const brevRad = maskerAlleStrenger({
    brevdato: input.brevdato || null,
    avsender: input.avsender.trim() || null,
    avsender_epost: input.avsender_epost.trim() || null,
    brevtype: input.brevtype,
    belop: input.belop,
    original_tekst: input.original_tekst,
    forklaring: brevforklaring(input),
    foreslatte_steg: input.foreslatte_steg,
    foreslatte_frister: valgteFrister,
    kostnadslinjer: linjer.length > 0 ? linjer : null,
    gebyrsjekk:
      gebyrsjekk && (gebyrsjekk.linjer.length > 0 || gebyrsjekk.sumkontroll)
        ? gebyrsjekk
        : null,
    fristfunn: kontroll.fristfunn,
    alvorlig: kontroll.alvorlig,
    belop_hovedstol: input.hovedstol,
  });
  const fristRader = nyeFrister.map((f) => ({
    tittel: maskerFodselsnummer(f.tittel),
    forfallsdato: f.forfallsdato,
    kilde: f.kilde,
  }));

  // 1) Bygg hele lagringen. Databasen låser saken, regner ut statusen med samme
  //    regel som lib/utfall.ts, og avviser lagringen hvis saken er endret.
  let nyttlast: Record<string, unknown>;
  if (input.krav.modus === "eksisterende") {
    const { data: sak } = await supabase
      .from("saker")
      .select("id, status, sist_endret")
      .eq("id", input.krav.sakId)
      .eq("bruker_id", user.id)
      .maybeSingle();
    if (!sak) return { ok: false, feil: "Fant ikke saken." };
    // Databasen avviser lagringen hvis saken er endret siden siden ble lest.
    // Sjekken skjer der, etter nøkkelen, så et nytt forsøk på et brev som
    // allerede ble lagret får det samme svaret og ikke «saken er endret».

    // Bare data og brukerens valg sendes. Statusen regnes ut i databasen
    // (brev_statusovergang), så et direkte kall ikke kan omgå bekreftelsen.
    const endring: Record<string, unknown> = {};
    if (stadium) endring.stadium = stadium;
    if (input.belop != null) endring.belop_totalt = input.belop;
    if (input.saksnummer.trim()) endring.saksnummer = input.saksnummer.trim();

    nyttlast = {
      modus: "eksisterende",
      sak_id: sak.id,
      forventet_status: sak.status,
      forventet_sist_endret: input.forventetSistEndret ?? sak.sist_endret,
      oppdater_sak: input.oppdaterSak === true,
      nokkel: input.lagringsnokkel,
      utfall: input.utfall,
      avslutning_bekreftet: input.avslutningBekreftet === true,
      gjenapne: input.gjenapne === true,
      sak: endring,
      brev: brevRad,
      frister: fristRader,
      erstatter: input.erstatterFrister ?? [],
      steg: maskerAlleStrenger(input.foreslatte_steg),
    };
  } else {
    nyttlast = {
      modus: "ny",
      nokkel: input.lagringsnokkel,
      sak: {
        tittel: input.krav.kreditor.trim() || input.avsender.trim() || "Nytt krav",
        kreditor: input.krav.kreditor.trim() || input.avsender.trim() || null,
        saksnummer: input.saksnummer.trim() || null,
        belop_totalt: input.belop,
        stadium,
      },
      brev: brevRad,
      frister: fristRader,
      erstatter: [],
      steg: maskerAlleStrenger(input.foreslatte_steg),
    };
  }

  // 2) Sak, brev, nye frister, erstattede frister og steg i én transaksjon
  //    (lagre_brev, migrasjon 0027). Feiler ett steg, lagres ingenting.
  const { data: lagret, error: lagreFeil } = await supabase.rpc("lagre_brev", {
    p: nyttlast,
  });
  const resultat = lagret as { sak_id?: string; brev_id?: string } | null;
  if (lagreFeil || !resultat?.sak_id || !resultat.brev_id) {
    logg("error", "legg-til-brev", "lagring_avvist", { kode: lagreFeil?.code ?? "ukjent" });
    return { ok: false, feil: lagreBrevFeilmelding(lagreFeil?.message) };
  }
  const sakId = resultat.sak_id;

  // 3) Hovedstol-konsistens (MEDHOLD_HOVEDSTOL_KONSISTENS-ARBEIDSORDRE §2) er
  //    avledet fra brevene og kan beregnes på nytt. Den lagres etter
  //    transaksjonen og påvirker ikke status eller frister. En helt ny sak har
  //    bare ett brev, så det er ingenting å sammenligne.
  if (input.krav.modus === "eksisterende") {
    const { data: alleBrev } = await supabase
      .from("brev")
      .select("id, brevdato, belop_hovedstol, opprettet")
      .eq("sak_id", sakId);
    const avvik = finnHovedstolAvvik((alleBrev ?? []) as HovedstolBrevInput[]);
    const { error } = await supabase
      .from("saker")
      .update({ hovedstol_avvik: avvik })
      .eq("id", sakId)
      .eq("bruker_id", user.id);
    if (error) logg("error", "legg-til-brev", "hovedstolavvik_ikke_oppdatert", { kode: error.code });
  }

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${sakId}`);
  return { ok: true, sakId, brevId: resultat.brev_id };
}

/**
 * Ligger et brev med samme dato og beløp i saken fra før (Del C.4)? Bare en
 * advarsel: feiler oppslaget, eller er noe uklart, svarer den null. Bruker
 * brukerens egen klient, så RLS avgjør hva som kan leses.
 */
export async function finnLiktBrev(input: {
  sakId: string;
  brevdato: string;
  belop: number | null;
  saksnummer: string;
}): Promise<{ brevId: string; opprettet: string } | null> {
  try {
    if (typeof input?.sakId !== "string" || !input.sakId) return null;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: sak }, { data: brev, error }] = await Promise.all([
      supabase.from("saker").select("saksnummer").eq("id", input.sakId).eq("bruker_id", user.id).maybeSingle(),
      supabase
        .from("brev")
        .select("id, brevdato, belop, opprettet")
        .eq("sak_id", input.sakId)
        .eq("bruker_id", user.id)
        .order("opprettet", { ascending: false }),
    ]);
    if (error || !sak) return null;
    const nytt = {
      brevdato: input.brevdato || null,
      belop: typeof input.belop === "number" && Number.isFinite(input.belop) ? input.belop : null,
      saksnummer: typeof input.saksnummer === "string" ? input.saksnummer : null,
    };
    // Brevet har ikke eget saksnummer; det lagrede brevet får sakens.
    const treff = (brev ?? []).find((b) =>
      erLiktBrev(nytt, {
        brevdato: (b.brevdato as string | null) ?? null,
        belop: (b.belop as number | null) ?? null,
        saksnummer: (sak.saksnummer as string | null) ?? null,
      }),
    );
    return treff ? { brevId: treff.id as string, opprettet: treff.opprettet as string } : null;
  } catch {
    return null;
  }
}
