// Kjernen i brevlesingen — skjema, systemprompt og selve AI-kallet — uten
// Next-kontekst (MEDHOLD_SIKKERHET_ARBEIDSORDRE §E.3). Brukes av
// legg-til-brev/actions.ts og av scripts/fasit-lesing.ts, slik at fasiten
// måler nøyaktig samme lesing som opplastingen. Relative importer med .ts-
// endelse, så filen også kan kjøres direkte av Node.
import Anthropic from "@anthropic-ai/sdk";
import { BREVTYPER, type BrevType } from "./gjeld.ts";
import { KOSTNADSTYPER, type Kostnadslinje } from "./gebyr.ts";
import { AI_MODELL, AI_MODELL_RASK } from "./ai.ts";
import {
  datoEllerTom,
  erObjekt,
  klassifiserAiFeil,
  lesStrukturert,
  type AiResultat,
} from "./ai-svar.ts";

// Strukturert utdata. «AI tolker, kode beslutter»: modellen trekker KUN ut det
// som eksplisitt står i brevet. Beregnede frister lages i kode, ikke her.
const SVAR_SKJEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    forklaring: {
      type: "string",
      description:
        "Forklaring på enkelt, kort, rolig norsk — 80–140 ord i TRE korte avsnitt (linjeskift mellom dem), ingen overskrifter. Avsnitt 1 «Hva dette er» (1–2 setninger: brevtype, avsender, beløp, hva kravet gjelder). Avsnitt 2 «Hva det betyr for deg» (2–3 setninger: hvor i prosessen saken står, hva som konkret skjer hvis man ikke gjør noe innen fristen — f.eks. mer salær, forliksråd, betalingsanmerkning, det faktiske neste trinnet for DETTE brevet — og evt. det som skiller brevet fra et standardbrev). Avsnitt 3 «Det viktigste nå» (én setning som peker på det som haster mest). Start ALDRI med hilsen eller «du har mottatt» — start rett på «Dette er …». INGEN forbehold/disclaimer (appen viser det selv).",
    },
    brevtype: {
      type: "string",
      enum: [...BREVTYPER],
      description:
        "Hvilken type brev dette er. 'namsmann': saken er hos/varslet namsmannen, inkl. varsel om utleggstrekk, utleggsforretning eller tvangsdekning i lønn. Bruk 'annet' hvis det ikke passer inn i gjeld-/inkassotrinnene.",
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
        "Sikt på 2–3 konkrete steg BRUKEREN kan gjøre utenfor appen, utledet av brevets konkrete innhold. Gir brevet naturlige dokumentasjonssteg (kvitteringer, oppsigelser, e-poster, betaling å verifisere i nettbank), bruk dem. Gir det IKKE det, foreslå heller FORBEREDENDE steg ut fra hva slags krav det er (f.eks. «Finn frem avtalen eller ordrebekreftelsen», «Sjekk kontoutskriften for mai og juni»). Helt tom liste er kun riktig når selv forberedende steg ville vært meningsløse (f.eks. et brev som bare bekrefter at en sak er avsluttet). Maks 3 steg. Hvert steg: imperativ, maks 10 ord, én konkret handling. Viktigst først. Foreslå ALDRI å betale/svare/bestride (brukerens eget valg i appen), å notere/huske fristen (appen beregner og varsler), å sjekke om gebyrer er lovlige (appen gjør det automatisk), eller generisk fyll («les brevet nøye», «ta kontakt hvis noe er uklart», «vurder å søke rådgivning»).",
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

Forklaringen — tre korte avsnitt, hvert med sin jobb (se også skjemafeltet):
1. «Hva dette er» — 1–2 setninger: brevtype, avsender, beløp, hva kravet gjelder.
2. «Hva det betyr for deg» — 2–3 setninger: hvor i prosessen saken står, hva som KONKRET skjer hvis man ikke gjør noe innen fristen (det faktiske neste trinnet for DETTE brevet — f.eks. mer salær, forliksråd, betalingsanmerkning, ikke en generisk formulering), og eventuelt det som skiller akkurat dette brevet fra et standardbrev (f.eks. varsel om rettslig inndriving).
3. «Det viktigste nå» — én setning som peker på den ene tingen som haster mest.
4. 80–140 ord totalt. Linjeskift mellom avsnittene, ingen overskrifter.
5. Start ALDRI med hilsen («hei») eller «du har mottatt» — start rett på «Dette er …».
6. Bruk ALDRI disse ordene/frasene: ${FYLL_FORBUD.map((f) => `«${f}»`).join(", ")}.

Foreslåtte steg — regler (se også skjemafeltet):
- Sikt på 2–3 steg. Maks 3.
- Hvert steg: imperativ, maks 10 ord, én konkret handling.
- Rekkefølge: viktigst først.
- Gir brevet naturlige dokumentasjonssteg (kvitteringer, oppsigelser, e-poster, betaling å verifisere i nettbank), bruk dem.
- Gir det IKKE det, foreslå heller forberedende steg ut fra hva slags krav det er (f.eks. «Finn frem avtalen eller ordrebekreftelsen», «Sjekk kontoutskriften for mai og juni»).
- Helt tom liste er kun riktig når selv forberedende steg ville vært meningsløse (f.eks. et brev som bare bekrefter at en sak er avsluttet).
- Foreslå ALDRI: betale/svare/bestride-valget, å notere/huske fristen, å sjekke om gebyrer er lovlige, eller generisk fyll («les brevet nøye», «ta kontakt hvis noe er uklart», «vurder å søke rådgivning»).`;
}

export type Analyse = {
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

export type Bilde = { media_type: string; data: string };

/** «4. november 2026» i norsk tid — dagens dato slik systemprompten bruker den. */
export function idagLang(): string {
  return new Date().toLocaleDateString("nb-NO", {
    timeZone: "Europe/Oslo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const SVAR_UTFALL = ["medhold", "delvis_medhold", "avvist", "nedbetalingstilbud", "uklart"] as const;

function strengListe(x: unknown): string[] | null {
  return Array.isArray(x) && x.every((s) => typeof s === "string") ? (x as string[]) : null;
}

/**
 * Streng validering av analysesvaret. Mangler et påkrevd felt, eller har det
 * feil type eller en verdi utenfor de tillatte, er hele svaret ugyldig (null).
 * Datoer som ikke er gyldige kalenderdatoer blir tomme (ukjent), ikke gjettet.
 * Bygger et nytt objekt, så ukjente ekstra felt aldri følger med videre.
 */
export function validerAnalyse(x: unknown): Analyse | null {
  if (!erObjekt(x)) return null;
  const tekstfelt = ["forklaring", "avsender", "avsender_epost", "belop", "hovedstol", "saksnummer"] as const;
  for (const f of tekstfelt) if (typeof x[f] !== "string") return null;
  if (!(x.forklaring as string).trim()) return null;
  if (typeof x.brevtype !== "string" || !(BREVTYPER as readonly string[]).includes(x.brevtype)) return null;
  if (typeof x.svar_utfall !== "string" || !(SVAR_UTFALL as readonly string[]).includes(x.svar_utfall)) return null;
  const brevdato = datoEllerTom(x.brevdato);
  if (brevdato === null) return null;

  const steg = strengListe(x.foreslatte_steg);
  if (!steg) return null;

  if (!Array.isArray(x.foreslatte_frister)) return null;
  const frister: Analyse["foreslatte_frister"] = [];
  for (const f of x.foreslatte_frister) {
    if (!erObjekt(f) || typeof f.tittel !== "string") return null;
    const dato = datoEllerTom(f.forfallsdato);
    if (dato === null) return null;
    frister.push({ tittel: f.tittel, forfallsdato: dato });
  }

  if (!Array.isArray(x.kostnadslinjer)) return null;
  const linjer: Kostnadslinje[] = [];
  for (const l of x.kostnadslinjer) {
    if (!erObjekt(l)) return null;
    if (typeof l.type !== "string" || !(KOSTNADSTYPER as readonly string[]).includes(l.type)) return null;
    if (typeof l.belop !== "number" || !Number.isFinite(l.belop) || l.belop < 0) return null;
    if (typeof l.tekst !== "string") return null;
    linjer.push({ type: l.type as Kostnadslinje["type"], belop: l.belop, tekst: l.tekst });
  }

  return {
    forklaring: x.forklaring as string,
    brevtype: x.brevtype as BrevType,
    avsender: x.avsender as string,
    avsender_epost: x.avsender_epost as string,
    brevdato,
    belop: x.belop as string,
    hovedstol: x.hovedstol as string,
    saksnummer: x.saksnummer as string,
    svar_utfall: x.svar_utfall as Analyse["svar_utfall"],
    foreslatte_steg: steg,
    foreslatte_frister: frister,
    kostnadslinjer: linjer,
  };
}

/** Som validerAnalyse, og i tillegg en ikke-tom transkripsjon av brevet. */
export function validerVisjonsanalyse(x: unknown): (Analyse & { ekstrahert_tekst: string }) | null {
  const a = validerAnalyse(x);
  if (!a || !erObjekt(x)) return null;
  if (typeof x.ekstrahert_tekst !== "string" || !x.ekstrahert_tekst.trim()) return null;
  return { ...a, ekstrahert_tekst: x.ekstrahert_tekst };
}

/**
 * Leser en innlimt brevtekst. Kaster aldri: nettverks- og API-feil, avkuttede
 * og ugyldige svar kommer tilbake som en feiltype.
 */
export async function lesBrevTekst(
  anthropic: Anthropic,
  tekst: string,
  idag: string = idagLang(),
): Promise<AiResultat<Analyse>> {
  try {
    const svar = await anthropic.messages.create({
      model: AI_MODELL_RASK,
      max_tokens: 2000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: SVAR_SKJEMA } },
      // Kun teksten brukeren selv limer inn sendes til Anthropic (GDPR).
      messages: [{ role: "user", content: `Her er teksten fra brevet:\n\n${tekst}` }],
    });
    return lesStrukturert(svar, validerAnalyse);
  } catch (e) {
    return { ok: false, feil: klassifiserAiFeil(e), bruk: null };
  }
}

/** Leser ett eller to bilder/PDF-er av brevet, og transkriberer teksten. Kaster aldri. */
export async function lesBrevBilder(
  anthropic: Anthropic,
  bilder: Bilde[],
  idag: string = idagLang(),
): Promise<AiResultat<Analyse & { ekstrahert_tekst: string }>> {
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
  try {
    const svar = await anthropic.messages.create({
      model: AI_MODELL,
      max_tokens: 3000,
      thinking: { type: "disabled" },
      system: systemprompt(idag),
      output_config: { format: { type: "json_schema", schema: VISJON_SKJEMA } },
      messages: [{ role: "user", content: innhold }],
    });
    return lesStrukturert(svar, validerVisjonsanalyse);
  } catch (e) {
    return { ok: false, feil: klassifiserAiFeil(e), bruk: null };
  }
}
