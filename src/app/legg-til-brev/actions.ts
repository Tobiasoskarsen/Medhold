"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SAK_UTFALL, type FristForslag, type SakStatus, type SakUtfall } from "@/lib/types";
import { beregnFrist, foreslaStadium, type BrevType } from "@/lib/gjeld";
import { statusVedNyttBrev, utfallAvslutter } from "@/lib/utfall";
import { lagreBrevFeilmelding } from "@/lib/saksstatus";
import { idagOslo } from "@/lib/dato";
import { AI_MODELL_RASK } from "@/lib/ai";
import { maskerFodselsnummer } from "@/lib/maskering";
import { tolkKr, tellOrd, kuttTilMaks } from "@/lib/format";
import {
  sjekkKostnader,
  type Kostnadslinje,
  type GebyrsjekkResultat,
} from "@/lib/gebyr";
import { erAlvorligSak } from "@/lib/alvorsgrense";
import type { FristSammenligning } from "@/lib/frist";
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
// Kode-tak (80–140 er prompt-målet i §1.1). Nedre grense er like viktig som
// øvre — en forklaring under 80 ord dekker sjelden alle tre avsnittene godt.
const FORKLARING_TAK_OVER = 180;
const FORKLARING_TAK_UNDER = 80;

/**
 * Ber om en omskrevet versjon av en forklaring som er for lang ELLER for
 * tynn. Frittstående, minimalt kall — trenger ikke brevteksten på nytt, kun
 * å skrive om teksten som allerede finnes (ingen ny faktautledning, se
 * guardrail 1). Feiler kallet, returneres null og originalen beholdes.
 */
async function korrigerForklaring(
  forklaring: string,
  problem: "for_lang" | "for_tynn",
): Promise<string | null> {
  const oppgave =
    problem === "for_lang"
      ? `Denne forklaringen er for lang:\n\n${forklaring}\n\nSkriv den om til 80–140 ord.`
      : `Denne forklaringen er for tynn og dekker ikke alle tre avsnittene godt nok:\n\n${forklaring}\n\nSkriv den om til 80–140 ord, med mer substans i avsnitt 2 spesielt (hva som konkret skjer ved fristoversittelse). Bruk KUN fakta som allerede står i teksten over — finn ALDRI på nye tall, beløp, satser eller detaljer som ikke allerede er nevnt. Utdyp ved å forklare KONSEKVENSENE av det som allerede står der, i klarere og mer konkret språk — ikke ved å legge til ny informasjon.`;
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL_RASK,
      max_tokens: 400,
      thinking: { type: "disabled" },
      system:
        "Du skriver om en forklaringstekst til riktig lengde. Du endrer ALDRI meningsinnholdet og finner ALDRI på nye fakta, tall eller detaljer som ikke allerede står i teksten du får oppgitt.",
      messages: [
        {
          role: "user",
          content: `${oppgave} Behold strukturen: avsnitt 1 «hva dette er», avsnitt 2 «hva det betyr for deg» (hvor saken står, hva som konkret skjer ved fristoversittelse, evt. hva som skiller brevet fra standard), avsnitt 3 «det viktigste nå» (én setning). Linjeskift mellom avsnittene, ingen overskrifter, ingen forbehold/disclaimer. Svar KUN med den nye forklaringsteksten — ingen annen tekst.`,
        },
      ],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    return blokk && blokk.type === "text" ? blokk.text.trim() : null;
  } catch (feil) {
    console.error("[legg-til-brev] Omskriving av forklaring feilet:", feil);
    return null;
  }
}

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
}> {
  // Steg: maks 3, prioritert rekkefølge → trygt å kutte uten regenerering.
  analyse.foreslatte_steg = kuttTilMaks(analyse.foreslatte_steg, MAKS_STEG);
  for (const steg of analyse.foreslatte_steg) {
    if (tellOrd(steg) > MAKS_STEG_ORD) {
      console.warn(
        `[legg-til-brev] Foreslått steg over ${MAKS_STEG_ORD} ord: "${steg}"`,
      );
    }
  }

  // Forklaring: utenfor 80–180 ord → én regenerering (ikke en løkke).
  // Fortsatt utenfor taket etterpå → behold og logg, ikke blokkér brukeren.
  const ordtall = tellOrd(analyse.forklaring);
  if (ordtall > FORKLARING_TAK_OVER || ordtall < FORKLARING_TAK_UNDER) {
    const problem = ordtall > FORKLARING_TAK_OVER ? "for_lang" : "for_tynn";
    const korrigert = await korrigerForklaring(analyse.forklaring, problem);
    if (korrigert) {
      const nyttAntall = tellOrd(korrigert);
      if (nyttAntall > FORKLARING_TAK_OVER || nyttAntall < FORKLARING_TAK_UNDER) {
        console.warn(
          `[legg-til-brev] Forklaring fortsatt utenfor 80–180 ord etter omskriving (${nyttAntall} ord).`,
        );
      }
      analyse.forklaring = korrigert;
    }
  }

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

  return { beregnetFrist, kravForslag, gebyrsjekk, alvorlig };
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

  let analyse: Analyse;
  try {
    const lest = await lesBrevTekst(new Anthropic(), rensket);
    if (!lest)
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    analyse = lest;
  } catch {
    return { ok: false, feil: "Noe gikk galt under analysen. Prøv igjen om litt." };
  }

  // Masker fødselsnumre før teksten lagres/vises videre (AI-kallet over kjørte
  // på originalen — det er den uunngåelige første sendingen). Alvorsgrensen
  // sjekkes mot samme (maskerte) tekst som lagres og vises senere.
  const original_tekst = maskerFodselsnummer(rensket);
  const { beregnetFrist, kravForslag, gebyrsjekk, alvorlig } =
    await etterbehandle(supabase, analyse, original_tekst);
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

  let analyse: Analyse & { ekstrahert_tekst: string };
  try {
    const lest = await lesBrevBilder(new Anthropic(), bilder);
    if (!lest)
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    analyse = lest;
  } catch {
    return { ok: false, feil: "Kunne ikke lese bildet. Prøv et tydeligere bilde." };
  }

  const { ekstrahert_tekst, ...rest } = analyse;
  const original_tekst = maskerFodselsnummer(ekstrahert_tekst);
  const { beregnetFrist, kravForslag, gebyrsjekk, alvorlig } =
    await etterbehandle(supabase, rest, original_tekst);
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
};

export type LagreBrevResultat =
  | { ok: true; sakId: string }
  | { ok: false; feil: string };

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

  // Utfall: bare kjente verdier, og et utfall som avslutter saken krever
  // eksplisitt bekreftelse, også ved direkte kall.
  if (input.utfall !== null && !(SAK_UTFALL as readonly string[]).includes(input.utfall))
    return { ok: false, feil: "Ukjent utfall." };
  if (input.utfall && utfallAvslutter(input.utfall) && input.avslutningBekreftet !== true)
    return { ok: false, feil: "Bekreft at saken skal avsluttes." };

  const linjer = input.kostnadslinjer ?? [];

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

  const nyeFrister = input.valgteFrister.filter((f) => f.forfallsdato);
  const brevRad = {
    brevdato: input.brevdato || null,
    avsender: input.avsender.trim() || null,
    avsender_epost: input.avsender_epost.trim() || null,
    brevtype: input.brevtype,
    belop: input.belop,
    original_tekst: input.original_tekst,
    forklaring: input.forklaring,
    foreslatte_steg: input.foreslatte_steg,
    foreslatte_frister: input.valgteFrister,
    kostnadslinjer: linjer.length > 0 ? linjer : null,
    gebyrsjekk:
      gebyrsjekk && (gebyrsjekk.linjer.length > 0 || gebyrsjekk.sumkontroll)
        ? gebyrsjekk
        : null,
    fristfunn: input.fristfunn,
    alvorlig: input.alvorlig,
    belop_hovedstol: input.hovedstol,
  };
  const fristRader = nyeFrister.map((f) => ({
    tittel: f.tittel,
    forfallsdato: f.forfallsdato,
    kilde: f.kilde,
  }));

  // 1) Bygg hele lagringen. Statusregelen er den ene i lib/utfall.ts; databasen
  //    låser saken og avviser lagringen hvis den er endret siden den ble lest.
  let nyttlast: Record<string, unknown>;
  if (input.krav.modus === "eksisterende") {
    const { data: sak } = await supabase
      .from("saker")
      .select("id, status, sist_endret")
      .eq("id", input.krav.sakId)
      .eq("bruker_id", user.id)
      .maybeSingle();
    if (!sak) return { ok: false, feil: "Fant ikke saken." };
    // En annen fane har endret saken siden siden ble lest.
    if (input.forventetSistEndret && input.forventetSistEndret !== sak.sist_endret)
      return { ok: false, feil: lagreBrevFeilmelding("MEDHOLD_SAK_ENDRET") };

    const ny = statusVedNyttBrev({
      statusNa: sak.status as SakStatus,
      utfall: input.utfall,
      nyeFrister: nyeFrister.map((f) => f.forfallsdato),
      idag: idagOslo(),
      gjenapne: input.gjenapne === true,
    });
    const endring: Record<string, unknown> = {};
    if (stadium) endring.stadium = stadium;
    if (input.belop != null) endring.belop_totalt = input.belop;
    if (input.saksnummer.trim()) endring.saksnummer = input.saksnummer.trim();
    if (ny.status !== sak.status) endring.status = ny.status;
    if (ny.utfall !== undefined) endring.utfall = ny.utfall;
    if (ny.stadium) endring.stadium = ny.stadium;

    nyttlast = {
      modus: "eksisterende",
      sak_id: sak.id,
      forventet_status: sak.status,
      forventet_sist_endret: sak.sist_endret,
      sak: endring,
      brev: brevRad,
      frister: fristRader,
      erstatter: input.erstatterFrister ?? [],
      steg: input.foreslatte_steg,
    };
  } else {
    nyttlast = {
      modus: "ny",
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
      steg: input.foreslatte_steg,
    };
  }

  // 2) Sak, brev, nye frister, erstattede frister og steg i én transaksjon
  //    (lagre_brev, migrasjon 0027). Feiler ett steg, lagres ingenting.
  const { data: lagret, error: lagreFeil } = await supabase.rpc("lagre_brev", {
    p: nyttlast,
  });
  const resultat = lagret as { sak_id?: string; brev_id?: string } | null;
  if (lagreFeil || !resultat?.sak_id) {
    console.error("[legg-til-brev] Lagring avvist:", lagreFeil?.code ?? "ukjent");
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
    if (error) console.error("[legg-til-brev] Hovedstolavvik ble ikke oppdatert.");
  }

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${sakId}`);
  return { ok: true, sakId };
}
