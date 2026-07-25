"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FristForslag, SakUtfall } from "@/lib/types";
import { beregnFrist, foreslaStadium, BREVTYPER, type BrevType } from "@/lib/gjeld";
import { utfallOvergang } from "@/lib/utfall";
import { AI_MODELL } from "@/lib/ai";
import { maskerFodselsnummer } from "@/lib/maskering";
import { tolkKr, tellOrd, kuttTilMaks } from "@/lib/format";
import {
  sjekkKostnader,
  KOSTNADSTYPER,
  type Kostnadslinje,
  type GebyrsjekkResultat,
} from "@/lib/gebyr";

// Strukturert utdata. «AI tolker, kode beslutter»: modellen trekker KUN ut det
// som eksplisitt står i brevet. Beregnede frister lages i kode, ikke her.
const SVAR_SKJEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    forklaring: {
      type: "string",
      description:
        "Forklaring på enkelt, kort, rolig norsk — maks 70 ord, ett avsnitt, ingen linjeskift/overskrifter. Struktur: (1) første setning om hva brevet ER og hva de krever, mønster «Dette er {brevtype i klartekst} fra {avsender} med krav på {beløp}.» (uten beløp/avsender når de mangler); (2) deretter maks 3 korte setninger (maks ca. 20 ord hver) om det viktigste — hva kravet gjelder, hva som skjer ved fristoversittelse, og evt. det som skiller brevet fra et standardbrev. Start ALDRI med hilsen eller «du har mottatt» — start rett på «Dette er …». INGEN forbehold/disclaimer (appen viser det selv).",
    },
    brevtype: {
      type: "string",
      enum: [...BREVTYPER],
      description:
        "Hvilken type brev dette er. Bruk 'annet' hvis det ikke passer inn i gjeld-/inkassotrinnene.",
    },
    avsender: {
      type: "string",
      description: "Hvem brevet er fra (inkassoselskap/kreditor). Tom hvis uklart.",
    },
    avsender_epost: {
      type: "string",
      description:
        "E-postadressen til avsenderen slik den står trykket i brevet. KUN hvis den står eksplisitt. Ellers tom streng.",
    },
    brevdato: {
      type: "string",
      description:
        "Dato brevet er datert, ÅÅÅÅ-MM-DD. KUN hvis den står i brevet. Ellers tom streng.",
    },
    belop: {
      type: "string",
      description:
        "Totalt utestående beløp i kroner. Bruk komma for øre hvis beløpet har det, f.eks. «3201,80» — ellers bare heltallet, f.eks. «3201». ALDRI mellomrom, punktum eller «kr» i tallet. KUN hvis det står eksplisitt. Ellers tom streng.",
    },
    hovedstol: {
      type: "string",
      description:
        "Opprinnelig hovedstol/hovedkrav — selve gjelden FØR gebyrer, renter og salær — i kroner. Bruk komma for øre hvis beløpet har det, f.eks. «3201,80» — ellers bare heltallet, f.eks. «3201». ALDRI mellomrom, punktum eller «kr» i tallet. KUN hvis den står eksplisitt i brevet (ofte som «hovedstol», «hovedkrav» eller «opprinnelig beløp»). Ellers tom streng.",
    },
    saksnummer: {
      type: "string",
      description: "Saks-/referansenummer. KUN hvis det står i brevet. Ellers tom streng.",
    },
    svar_utfall: {
      type: "string",
      enum: [
        "medhold",
        "delvis_medhold",
        "avvist",
        "nedbetalingstilbud",
        "uklart",
      ],
      description:
        "Hvis brevet er et SVAR på en innsigelse/klage/anmodning fra mottakeren: hva svaret innebærer. KUN når det fremgår eksplisitt. Ellers 'uklart'.",
    },
    foreslatte_steg: {
      type: "array",
      description:
        "Maks 3 konkrete steg BRUKEREN kan gjøre utenfor appen (finne dokumentasjon, verifisere betaling i nettbank, hente frem en avtale), utledet KUN av brevets konkrete innhold. Tom liste er et gyldig og ofte riktig svar. Hvert steg: imperativ, maks 10 ord, én konkret handling. Viktigst først. Foreslå ALDRI å betale/svare/bestride (brukerens eget valg i appen), å notere/huske fristen (appen beregner og varsler), å sjekke om gebyrer er lovlige (appen gjør det automatisk), eller generisk fyll («les brevet nøye», «ta kontakt hvis noe er uklart», «vurder å søke rådgivning»).",
      items: { type: "string" },
    },
    foreslatte_frister: {
      type: "array",
      description: "Frister som STÅR EKSPLISITT i brevet. Aldri funnet opp.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tittel: { type: "string" },
          forfallsdato: {
            type: "string",
            description:
              "Konkret dato ÅÅÅÅ-MM-DD hvis brevet oppgir en eksakt dato. Ellers tom streng.",
          },
        },
        required: ["tittel", "forfallsdato"],
      },
    },
    kostnadslinjer: {
      type: "array",
      description:
        "Kostnadslinjer som STÅR EKSPLISITT oppført i brevet (gebyrer, salær, renter, rettsgebyr). Tom hvis ingen. Summer aldri linjer sammen, og ta ALDRI med hovedstolen/selve hovedkravet her. Er typen uklar, bruk 'annet'.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: [...KOSTNADSTYPER],
            description:
              "Type kostnad. Bruk 'annet' hvis den ikke passer en av de andre typene.",
          },
          belop: {
            type: "number",
            description: "Beløpet for denne linjen i kroner, slik det står i brevet.",
          },
          tekst: {
            type: "string",
            description: "Linjen slik den står i brevet. Maks 120 tegn.",
          },
        },
        required: ["type", "belop", "tekst"],
      },
    },
  },
  required: [
    "forklaring",
    "brevtype",
    "avsender",
    "avsender_epost",
    "brevdato",
    "belop",
    "hovedstol",
    "saksnummer",
    "svar_utfall",
    "foreslatte_steg",
    "foreslatte_frister",
    "kostnadslinjer",
  ],
} as const;

// Fraser forklaringen ALDRI skal inneholde (analyse-kort-ordren §1.1) —
// polstring/empati-innledninger som spiser ord uten å tilføre informasjon.
const FYLL_FORBUD = [
  "det er forståelig",
  "det er helt normalt",
  "ta det med ro",
  "ikke få panikk",
  "vi forstår at",
  "dette kan virke overveldende",
  "først og fremst",
  "det er viktig å merke seg",
  "kort oppsummert",
];

function systemprompt(idag: string): string {
  return `Du hjelper en person som har fått et brev om gjeld/inkasso og ofte er overveldet.

Oppgaven din: forklar hva brevet betyr, foreslå konkrete neste steg, og trekk ut nøkkelfakta.

Ufravikelige regler:
- Svar på enkelt, rolig og KORT norsk (bokmål). Klarhet er omsorgen — ingen utfyllende trøstesetninger. Unngå byråkratspråk.
- Du FORKLARER og FORESLÅR. Du gir ALDRI juridiske eller økonomiske vedtak, konklusjoner eller garantier.
- Finn ALDRI opp frister, beløp, datoer, saksnummer, paragrafer eller fakta som ikke står i teksten. Er noe uklart, la feltet stå tomt.
- Oppgi brevdato, beløp, saksnummer og avsenderens e-postadresse KUN når de står eksplisitt i brevet. Ellers tom streng.
- Skill mellom totalt utestående beløp (belop) og opprinnelig hovedstol (hovedstol = selve gjelden før gebyrer, renter og salær). Oppgi hovedstol kun når den står eksplisitt; ellers tom streng.
- Foreslå kun frister som er eksplisitt nevnt i brevet, med dato kun når en konkret dato er oppgitt.
- Trekk ut kostnadslinjer (gebyrer, salær, renter, rettsgebyr) KUN slik de står oppført i brevet, hver som egen linje med sitt beløp. Summer aldri, utled aldri, og ta ALDRI med hovedstolen/selve hovedkravet som en kostnadslinje. Er typen uklar, bruk 'annet'.
- I dag er ${idag}. Bruk dette bare til å forstå teksten – ikke til å regne ut frister som ikke står der.
- Ikke inkluder forbehold eller disclaimere i forklaringen; appen viser dette selv.

Forklaringen — struktur (se også skjemafeltet):
1. Første setning: hva brevet ER og hva de krever. Mønster: «Dette er {brevtype i klartekst} fra {avsender} med krav på {beløp}.» (uten beløp/avsender når de mangler).
2. Deretter maks 3 korte setninger om det viktigste: hva kravet gjelder, hva som skjer hvis man ikke gjør noe innen fristen, og eventuelt det som skiller akkurat dette brevet fra et standardbrev (f.eks. varsel om rettslig inndriving). Ingen setning over ca. 20 ord.
3. Maks 70 ord totalt. Ett avsnitt. Ingen linjeskift, ingen overskrifter.
4. Start ALDRI med hilsen («hei») eller «du har mottatt» — start rett på «Dette er …».
5. Bruk ALDRI disse ordene/frasene: ${FYLL_FORBUD.map((f) => `«${f}»`).join(", ")}.

Foreslåtte steg — regler (se også skjemafeltet):
- Maks 3 steg. Færre er bedre. Tom liste er et gyldig og ofte riktig svar.
- Hvert steg: imperativ, maks 10 ord, én konkret handling.
- Rekkefølge: viktigst først.
- Foreslå ALDRI: betale/svare/bestride-valget, å notere/huske fristen, å sjekke om gebyrer er lovlige, eller generisk fyll («les brevet nøye», «ta kontakt hvis noe er uklart», «vurder å søke rådgivning»).
- Steg skal være ting bare brukeren kan gjøre utenfor appen: finne dokumentasjon (kvitteringer, oppsigelser, e-poster), verifisere betaling i nettbank, hente frem en avtale — utledet av brevets konkrete innhold.`;
}

type Analyse = {
  forklaring: string;
  brevtype: BrevType;
  avsender: string;
  avsender_epost: string;
  brevdato: string;
  belop: string;
  hovedstol: string;
  saksnummer: string;
  svar_utfall:
    | "medhold"
    | "delvis_medhold"
    | "avvist"
    | "nedbetalingstilbud"
    | "uklart";
  foreslatte_steg: string[];
  foreslatte_frister: { tittel: string; forfallsdato: string }[];
  kostnadslinjer: Kostnadslinje[];
};

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
    }
  | { ok: false; feil: string };

// Kodehåndhevelse av analyse-kort-ordrens §2.2-tak. «AI tolker, kode
// beslutter» — også for lengde/antall.
const MAKS_STEG = 3;
const MAKS_STEG_ORD = 14;
// Kode-tak (70 er prompt-målet i §1.1; 110 er terskelen som utløser én
// regenerering — se etterbehandle()).
const FORKLARING_TAK = 110;

/**
 * Ber om en kortere versjon av en for lang forklaring. Frittstående, minimalt
 * kall — trenger ikke brevteksten på nytt, kun å skrive om teksten som
 * allerede finnes (ingen ny faktautledning, se guardrail 1). Feiler kallet,
 * returneres null og den opprinnelige forklaringen beholdes.
 */
async function korteForklaring(forklaring: string): Promise<string | null> {
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 300,
      thinking: { type: "disabled" },
      system:
        "Du skriver om en forklaringstekst til å bli kortere, uten å endre meningsinnholdet eller finne på nye fakta.",
      messages: [
        {
          role: "user",
          content: `Denne forklaringen er for lang:\n\n${forklaring}\n\nSkriv den om til under 70 ord. Behold strukturen: første setning om hva brevet er og krever, deretter maks tre korte setninger om det viktigste. Ett avsnitt, ingen linjeskift, ingen overskrifter, ingen forbehold/disclaimer. Svar KUN med den nye forklaringsteksten — ingen annen tekst.`,
        },
      ],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    return blokk && blokk.type === "text" ? blokk.text.trim() : null;
  } catch (feil) {
    console.error("[legg-til-brev] Forkorting av forklaring feilet:", feil);
    return null;
  }
}

// Kode beslutter: beregn frist av regel + match mot eksisterende krav, kutt
// steg-lista og kort ned en for lang forklaring. Deles mellom tekst- og
// bildeanalysen. Muterer analyse.forklaring/foreslatte_steg direkte — kalleren
// leser de samme (nå rettede) feltene fra sitt eget analyse-objekt etterpå.
async function etterbehandle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analyse: Analyse,
): Promise<{
  beregnetFrist: { tittel: string; forfallsdato: string } | null;
  kravForslag: KravForslag | null;
  gebyrsjekk: GebyrsjekkResultat | null;
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

  // Forklaring: over kode-taket → én regenerering (ikke en løkke). Fortsatt
  // over taket etterpå → behold og logg, ikke blokkér brukeren.
  if (tellOrd(analyse.forklaring) > FORKLARING_TAK) {
    const kortere = await korteForklaring(analyse.forklaring);
    if (kortere) {
      if (tellOrd(kortere) > FORKLARING_TAK) {
        console.warn(
          `[legg-til-brev] Forklaring fortsatt over ${FORKLARING_TAK} ord etter omskriving.`,
        );
      }
      analyse.forklaring = kortere;
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
  return { beregnetFrist, kravForslag, gebyrsjekk };
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

  const idag = new Date().toLocaleDateString("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let analyse: Analyse;
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: SVAR_SKJEMA } },
      // Kun teksten brukeren selv limer inn sendes til Anthropic (GDPR).
      messages: [{ role: "user", content: `Her er teksten fra brevet:\n\n${rensket}` }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    analyse = JSON.parse(blokk.text) as Analyse;
  } catch {
    return { ok: false, feil: "Noe gikk galt under analysen. Prøv igjen om litt." };
  }

  const { beregnetFrist, kravForslag, gebyrsjekk } = await etterbehandle(
    supabase,
    analyse,
  );
  return {
    ok: true,
    analyse,
    // Masker fødselsnumre før teksten lagres/vises videre (AI-kallet over kjørte
    // på originalen — det er den uunngåelige første sendingen).
    original_tekst: maskerFodselsnummer(rensket),
    beregnetFrist,
    kravForslag,
    gebyrsjekk,
  };
}

export type Bilde = { media_type: string; data: string };

// Vision-skjema: samme som tekst, men modellen transkriberer også brevet slik
// at vi kan lagre teksten (ikke bildet). Maks 2 bilder per brev.
const VISJON_SKJEMA = {
  ...SVAR_SKJEMA,
  properties: {
    ...SVAR_SKJEMA.properties,
    ekstrahert_tekst: {
      type: "string",
      description: "Ordrett transkripsjon av all tekst i brevet.",
    },
  },
  required: [...SVAR_SKJEMA.required, "ekstrahert_tekst"],
} as const;

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

  const idag = new Date().toLocaleDateString("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const innhold: Anthropic.ContentBlockParam[] = bilder.map((b) =>
    b.media_type === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: b.data },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: b.media_type as
              | "image/jpeg"
              | "image/png"
              | "image/webp"
              | "image/gif",
            data: b.data,
          },
        },
  );
  innhold.push({
    type: "text",
    text: "Her er brevet som bilde(r). Transkriber teksten og analyser det etter reglene.",
  });

  let analyse: Analyse & { ekstrahert_tekst: string };
  try {
    const anthropic = new Anthropic();
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 3000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: VISJON_SKJEMA } },
      messages: [{ role: "user", content: innhold }],
    });
    const blokk = svar.content.find((b) => b.type === "text");
    if (!blokk || blokk.type !== "text")
      return { ok: false, feil: "Fikk ikke et brukbart svar. Prøv igjen." };
    analyse = JSON.parse(blokk.text) as Analyse & { ekstrahert_tekst: string };
  } catch {
    return { ok: false, feil: "Kunne ikke lese bildet. Prøv et tydeligere bilde." };
  }

  const { ekstrahert_tekst, ...rest } = analyse;
  const { beregnetFrist, kravForslag, gebyrsjekk } = await etterbehandle(
    supabase,
    rest,
  );
  return {
    ok: true,
    analyse: rest,
    original_tekst: maskerFodselsnummer(ekstrahert_tekst),
    beregnetFrist,
    kravForslag,
    gebyrsjekk,
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

  const stadium = foreslaStadium(input.brevtype ?? "annet");

  // Rekalkuler gebyrsjekken fra de endelige verdiene brukeren bekreftet (kode
  // beslutter). Retter brukeren et feillest beløp, følger vurderingen med.
  // Lagret jsonb er sannheten for visning senere — ikke rekalkuler ved lesing.
  const linjer = input.kostnadslinjer ?? [];
  const gebyrsjekk =
    linjer.length > 0
      ? sjekkKostnader(linjer, input.hovedstol ?? input.belop, input.brevdato || null)
      : null;

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
      gebyrsjekk: gebyrsjekk && gebyrsjekk.linjer.length > 0 ? gebyrsjekk : null,
    })
    .select("id")
    .single();
  if (brevFeil || !brev)
    return { ok: false, feil: "Kunne ikke lagre brevet. Prøv igjen." };

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
