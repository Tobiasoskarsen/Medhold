"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FristForslag, SakUtfall } from "@/lib/types";
import { beregnFrist, foreslaStadium, type BrevType } from "@/lib/gjeld";
import { utfallOvergang } from "@/lib/utfall";
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

  if (bilder.length === 0)
    return { ok: false, feil: "Legg til minst ett bilde av brevet." };
  if (bilder.length > 2)
    return { ok: false, feil: "Maks to bilder per brev." };
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

  // 1) Finn eller opprett kravet (saken), og hold nøkkelfeltene oppdatert.
  let sakId: string;
  if (input.krav.modus === "eksisterende") {
    sakId = input.krav.sakId;
    const oppdatering: Record<string, unknown> = {};
    if (stadium) oppdatering.stadium = stadium;
    if (input.belop != null) oppdatering.belop_totalt = input.belop;
    if (input.saksnummer.trim()) oppdatering.saksnummer = input.saksnummer.trim();
    // Bekreftet utfall (kode beslutter) overstyrer status/stadium.
    if (input.utfall) {
      const o = utfallOvergang(input.utfall);
      oppdatering.utfall = o.utfall;
      oppdatering.status = o.status;
      if (o.stadium) oppdatering.stadium = o.stadium;
    }
    if (Object.keys(oppdatering).length > 0) {
      await supabase.from("saker").update(oppdatering).eq("id", sakId);
    }
  } else {
    const navn = input.krav.kreditor.trim() || input.avsender.trim() || "Nytt krav";
    const { data: sak, error } = await supabase
      .from("saker")
      .insert({
        bruker_id: user.id,
        tittel: navn,
        kreditor: input.krav.kreditor.trim() || input.avsender.trim() || null,
        saksnummer: input.saksnummer.trim() || null,
        belop_totalt: input.belop,
        stadium,
        status: "aktiv",
        kategori: "okonomi",
      })
      .select("id")
      .single();
    if (error || !sak)
      return { ok: false, feil: "Kunne ikke opprette kravet. Prøv igjen." };
    sakId = sak.id;
  }

  // 2) Lagre brevet.
  const { data: brev, error: brevFeil } = await supabase
    .from("brev")
    .insert({
      sak_id: sakId,
      bruker_id: user.id,
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
    })
    .select("id")
    .single();
  if (brevFeil || !brev)
    return { ok: false, feil: "Kunne ikke lagre brevet. Prøv igjen." };

  // 2b) Hovedstol-konsistens på tvers av saken (MEDHOLD_HOVEDSTOL_KONSISTENS-
  // ARBEIDSORDRE §2): beregnes IKKE ved hver sidevisning — kun her, rett etter
  // et NYTT brev er lagret på en EKSISTERENDE sak (en helt ny sak har per
  // definisjon bare ett brev, ingenting å sammenligne). Lagret jsonb er
  // sannheten ved visning (krav-detalj/saks-listen), rekalkuleres aldri der.
  if (input.krav.modus === "eksisterende") {
    const { data: alleBrev } = await supabase
      .from("brev")
      .select("id, brevdato, belop_hovedstol, opprettet")
      .eq("sak_id", sakId);
    const avvik = finnHovedstolAvvik((alleBrev ?? []) as HovedstolBrevInput[]);
    await supabase
      .from("saker")
      .update({ hovedstol_avvik: avvik })
      .eq("id", sakId);
  }

  // 3) Frister (med riktig kilde) og steg.
  const frister = input.valgteFrister.filter((f) => f.forfallsdato);
  if (frister.length > 0) {
    await supabase.from("frister").insert(
      frister.map((f) => ({
        sak_id: sakId,
        bruker_id: user.id,
        tittel: f.tittel,
        forfallsdato: f.forfallsdato,
        brev_id: brev.id,
        kilde: f.kilde,
      })),
    );
  }
  if (input.foreslatte_steg.length > 0) {
    await supabase.from("neste_steg").insert(
      input.foreslatte_steg.map((tekst, i) => ({
        sak_id: sakId,
        bruker_id: user.id,
        tekst,
        rekkefolge: i,
      })),
    );
  }

  revalidatePath("/");
  revalidatePath("/krav");
  revalidatePath(`/krav/${sakId}`);
  return { ok: true, sakId };
}
