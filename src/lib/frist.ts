// Delt nedtellingslogikk (terskel + tekst) for Nedtelling og kravlistens
// nedtellingschip — samme regel begge steder (Sakslisteordre §2.2).
//
// `dagerTil` importeres IKKE videre herfra (var tidligere re-eksportert for
// bekvemmelighet) — Kravkort/Nedtelling importerer den direkte fra
// `@/lib/dato` i stedet (unngikk en unødvendig cross-lib-import her).

/** ≤10 dager igjen (eller passert/i dag) → hastende, ellers nøytral. */
export function erHastende(dagerIgjen: number): boolean {
  return dagerIgjen <= 10;
}

/** «8 dager igjen» / «I morgen» / «I dag» / «Frist utløpt». */
export function fristChipTekst(dagerIgjen: number): string {
  if (dagerIgjen < 0) return "Frist utløpt";
  if (dagerIgjen === 0) return "I dag";
  return dagerIgjen === 1 ? "I morgen" : `${dagerIgjen} dager igjen`;
}

// --- Gamle brev (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2) ------------------------
//
// Et brev som er mer enn 45 dager gammelt er trolig ikke det siste i saken.
// Da er en utløpt frist historikk, ikke en akutt fare, og brukeren bes legge
// til det nyeste brevet i stedet for å reagere på et gammelt funn.

export const GAMMELT_BREV_DAGER = 45;

/** Hele dager siden brevet (brevdato, ellers opprettet-datoen) til `idag`. */
export function brevAlderDager(
  brevdato: string | null,
  opprettet: string,
  idag: string,
): number {
  return dagerMellom(brevdato ?? opprettet.slice(0, 10), idag);
}

/** Brevet (brevdato, ellers opprettet) er MER enn 45 dager før i dag. */
export function erGammeltBrev(
  brevdato: string | null,
  opprettet: string,
  idag: string,
): boolean {
  return brevAlderDager(brevdato, opprettet, idag) > GAMMELT_BREV_DAGER;
}

// --- Fristduplisering (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §A) --------------
//
// AI-en trekker ut frister som STÅR i brevet (`eksplisitt`); koden beregner
// en lovpålagt frist av samme type (`beregnet`, se gjeld.ts sin beregnFrist).
// Uten sammenligning limes de bare sammen i listen — to nesten identiske
// rader ved enighet, eller et STILLE, ubemerket avvik når brevets frist er
// kortere enn loven krever. Denne funksjonen slår dem sammen til ÉN rad med
// en eksplisitt status, slik at et avvik blir synlig fakta i stedet for en
// dupliser­t detalj.

export type FristSammenligning = {
  visForfallsdato: string;
  visTittel: string;
  status:
    | "samstemmer"
    | "avvik_kortere"
    | "avvik_lengre"
    | "kun_eksplisitt"
    | "kun_beregnet";
  eksplisittDato: string | null;
  beregnetDato: string | null;
  differanseDager: number | null; // eksplisitt minus beregnet (negativ = kortere)
};

/** Hele dager mellom to rene datoer (YYYY-MM-DD), tolket som UTC-midnatt. */
export function dagerMellom(fra: string, til: string): number {
  const a = Date.parse(`${fra}T00:00:00Z`);
  const b = Date.parse(`${til}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Slår sammen en AI-uttrukket eksplisitt frist og en kodeberegnet frist til
 * én, med en status som forteller om de stemmer overens. `visForfallsdato`/
 * `visTittel` er raden som faktisk skal VISES: ved avvik er det ALLTID
 * brevets egen dato (den brukeren faktisk må forholde seg til), ikke lovens.
 */
export function sammenlignFrist(
  eksplisitt: { tittel: string; forfallsdato: string } | null,
  // Med vilje IKKE gjeld.ts sin BeregnetFrist (som også har `kilde`) — kun
  // tittel/forfallsdato brukes her, og actions.ts sin AnalyseResultat
  // returnerer nettopp denne strippede formen (kilde er ikke kjent før
  // sammenligningen er gjort, se fristSammenligningKilde i LeggTilBrevFlyt).
  beregnet: { tittel: string; forfallsdato: string } | null,
): FristSammenligning | null {
  if (!eksplisitt && !beregnet) return null;

  if (eksplisitt && !beregnet) {
    return {
      visForfallsdato: eksplisitt.forfallsdato,
      visTittel: eksplisitt.tittel,
      status: "kun_eksplisitt",
      eksplisittDato: eksplisitt.forfallsdato,
      beregnetDato: null,
      differanseDager: null,
    };
  }

  if (!eksplisitt && beregnet) {
    return {
      visForfallsdato: beregnet.forfallsdato,
      visTittel: beregnet.tittel,
      status: "kun_beregnet",
      eksplisittDato: null,
      beregnetDato: beregnet.forfallsdato,
      differanseDager: null,
    };
  }

  // Begge finnes (TS vet det ikke automatisk fra grenene over).
  const e = eksplisitt as { tittel: string; forfallsdato: string };
  const b = beregnet as { tittel: string; forfallsdato: string };

  if (e.forfallsdato === b.forfallsdato) {
    return {
      visForfallsdato: b.forfallsdato,
      visTittel: b.tittel,
      status: "samstemmer",
      eksplisittDato: e.forfallsdato,
      beregnetDato: b.forfallsdato,
      differanseDager: 0,
    };
  }

  const differanseDager = dagerMellom(b.forfallsdato, e.forfallsdato);
  return {
    visForfallsdato: e.forfallsdato,
    visTittel: e.tittel,
    status: differanseDager < 0 ? "avvik_kortere" : "avvik_lengre",
    eksplisittDato: e.forfallsdato,
    beregnetDato: b.forfallsdato,
    differanseDager,
  };
}
