// Gebyrsjekk-motor for inkassokostnader. Ren, deterministisk kode uten
// sideeffekter — «AI tolker, kode beslutter». AI-en trekker ut kostnadslinjene
// slik de STÅR i brevet; all vurdering av lovlighet skjer her, aldri i AI-en.
//
// Motoren er bevisst konservativ: rød («over») kun når beløpet overstiger den
// høyeste lovlige satsen som overhodet kan gjelde. Grensetilfeller blir gule
// («mulig_over») eller nøytrale («ukjent») heller enn falske anklager.
//
// Kilde for satsene: Finanstilsynet, «Oversikt over utenrettslige
// inndrivingskostnader». Verifisert mot Finanstilsynet 2026-07-15 — tallene
// under er identiske med ordrens §3. Satstabellen endres ALDRI uten ny
// Satsversjon med kilde-URL (se §9). Eksisterende versjoner redigeres ikke.

/** Én versjon av satstabellen, gyldig fra en gitt dato. */
export type Satsversjon = {
  gyldigFra: string; // ISO-dato, f.eks. "2026-01-01"
  kilde: string; // URL til Finanstilsynet
  inkassosats: number;
  purregebyr: number;
  inkassovarselGebyr: number;
  betalingsoppfordringGebyr: number; // egeninkasso
  rettsgebyr: number; // kun informativt i v1
  // Salærtrinn: øvre hovedstol-grense (null = «over 250 000») → maks salær.
  // A = kreditor har mva-fradragsrett (lavest), B = ikke fradragsrett (høyest).
  salaerForbruker: Array<{
    hovedstolTom: number | null;
    enkelA: number;
    tungA: number;
    enkelB: number;
    tungB: number;
  }>;
};

const FINANSTILSYNET_URL =
  "https://www.finanstilsynet.no/forbrukerinformasjon/inkassovirksomhet/oversikt-over-utenrettslige-inndrivingskostnader/";

export const SATSVERSJONER: Satsversjon[] = [
  {
    gyldigFra: "2026-01-01",
    kilde: FINANSTILSYNET_URL,
    inkassosats: 750,
    purregebyr: 38,
    inkassovarselGebyr: 38,
    betalingsoppfordringGebyr: 113,
    rettsgebyr: 1345,
    salaerForbruker: [
      { hovedstolTom: 500, enkelA: 187.5, tungA: 375, enkelB: 234.38, tungB: 468.75 },
      { hovedstolTom: 1000, enkelA: 262.5, tungA: 525, enkelB: 328.13, tungB: 656.25 },
      { hovedstolTom: 2500, enkelA: 300, tungA: 600, enkelB: 375, tungB: 750 },
      { hovedstolTom: 10000, enkelA: 600, tungA: 1200, enkelB: 750, tungB: 1500 },
      { hovedstolTom: 50000, enkelA: 1200, tungA: 2400, enkelB: 1500, tungB: 3000 },
      { hovedstolTom: 250000, enkelA: 2700, tungA: 5400, enkelB: 3375, tungB: 6750 },
      { hovedstolTom: null, enkelA: 5400, tungA: 10800, enkelB: 6750, tungB: 13500 },
    ],
  },
];

/** Versjonene sortert eldst → nyest. */
function versjonerSortert(): Satsversjon[] {
  return [...SATSVERSJONER].sort((a, b) => a.gyldigFra.localeCompare(b.gyldigFra));
}

/**
 * Nyeste satsversjon med gyldigFra <= dato. Dato mangler → nyeste versjon.
 * Dato før eldste versjon → eldste versjon returneres som fallback, men
 * sjekkKostnader markerer da alle linjer som «ukjent» (satsene fra brevets tid
 * er ikke lagt inn). Se sjekkKostnader.
 */
export function satserForDato(dato: string | null): Satsversjon {
  const sortert = versjonerSortert();
  if (dato === null) return sortert[sortert.length - 1];
  const gyldige = sortert.filter((v) => v.gyldigFra <= dato);
  if (gyldige.length === 0) return sortert[0];
  return gyldige[gyldige.length - 1];
}

export const KOSTNADSTYPER = [
  "purregebyr",
  "inkassovarselgebyr",
  "betalingsoppfordringsgebyr",
  "salaer",
  "forsinkelsesrente",
  "rettsgebyr",
  "annet",
] as const;
export type Kostnadstype = (typeof KOSTNADSTYPER)[number];

export type Kostnadslinje = {
  type: Kostnadstype;
  belop: number; // kr, som oppgitt i brevet
  tekst: string; // linjen slik den står i brevet (kort)
};

export type Vurdering = "innenfor" | "mulig_over" | "over" | "ukjent";

export type LinjeResultat = {
  linje: Kostnadslinje;
  vurdering: Vurdering;
  maksLav: number | null; // laveste relevante maks (A/enkel der aktuelt)
  maksHoy: number | null; // høyeste relevante maks (B/tung der aktuelt)
  differanse: number | null; // belop - maksHoy, kun når vurdering === "over"
  forklaring: string; // én kort norsk setning, kodegenerert
};

export type GebyrsjekkResultat = {
  satsGyldigFra: string;
  linjer: LinjeResultat[];
  antallOver: number;
  antallMuligOver: number;
};

// 1 kr slingring på alle grenser (avrunding i brevet skal ikke gi falsk «over»).
const SLINGRING = 1;

/** Norsk beløp med tusenskille, opptil to desimaler (for tekst). */
function kr(belop: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(belop);
}

/** ISO-dato → kort norsk «1.1.2026». */
function kortDato(iso: string): string {
  const [år, mnd, dag] = iso.split("-");
  return `${Number(dag)}.${Number(mnd)}.${år}`;
}

/** Salærtrinnet en hovedstol faller inn under. */
function finnSalaertrinn(
  sats: Satsversjon,
  hovedstol: number,
): Satsversjon["salaerForbruker"][number] {
  for (const trinn of sats.salaerForbruker) {
    if (trinn.hovedstolTom !== null && hovedstol <= trinn.hovedstolTom) {
      return trinn;
    }
  }
  // Ingen grense passet → «over 250 000»-trinnet (hovedstolTom === null).
  return sats.salaerForbruker[sats.salaerForbruker.length - 1];
}

/** Vurderer én kostnadslinje mot satsversjonen. */
function vurderLinje(
  linje: Kostnadslinje,
  hovedstol: number | null,
  sats: Satsversjon,
): LinjeResultat {
  const ukjent = (forklaring: string): LinjeResultat => ({
    linje,
    vurdering: "ukjent",
    maksLav: null,
    maksHoy: null,
    differanse: null,
    forklaring,
  });

  switch (linje.type) {
    case "purregebyr":
    case "inkassovarselgebyr":
    case "betalingsoppfordringsgebyr": {
      const maks =
        linje.type === "purregebyr"
          ? sats.purregebyr
          : linje.type === "inkassovarselgebyr"
            ? sats.inkassovarselGebyr
            : sats.betalingsoppfordringGebyr;
      if (linje.belop <= maks + SLINGRING) {
        return {
          linje,
          vurdering: "innenfor",
          maksLav: maks,
          maksHoy: maks,
          differanse: null,
          forklaring: `Innenfor maksimalsatsen på ${kr(maks)} kr.`,
        };
      }
      const differanse = linje.belop - maks;
      return {
        linje,
        vurdering: "over",
        maksLav: maks,
        maksHoy: maks,
        differanse,
        forklaring: `${kr(linje.belop)} kr overstiger maksimalsatsen på ${kr(maks)} kr med ${kr(differanse)} kr.`,
      };
    }

    case "salaer": {
      if (hovedstol === null) {
        return ukjent("Kan ikke vurdere salær uten kjent hovedstol.");
      }
      const trinn = finnSalaertrinn(sats, hovedstol);
      const maksLav = trinn.enkelA; // laveste lovlige (fradragsrett, enkel sak)
      const maksHoy = trinn.tungB; // høyeste lovlige (ingen fradragsrett, tung sak)
      if (linje.belop <= maksLav + SLINGRING) {
        return {
          linje,
          vurdering: "innenfor",
          maksLav,
          maksHoy,
          differanse: null,
          forklaring: `Innenfor laveste lovlige salærsats (${kr(maksLav)} kr).`,
        };
      }
      if (linje.belop <= maksHoy + SLINGRING) {
        return {
          linje,
          vurdering: "mulig_over",
          maksLav,
          maksHoy,
          differanse: null,
          forklaring:
            "Innenfor høyeste lovlige sats, men over laveste — avhenger av sakstype og kreditors mva-status.",
        };
      }
      const differanse = linje.belop - maksHoy;
      return {
        linje,
        vurdering: "over",
        maksLav,
        maksHoy,
        differanse,
        forklaring: `${kr(linje.belop)} kr overstiger høyeste lovlige salærsats (${kr(maksHoy)} kr) med ${kr(differanse)} kr.`,
      };
    }

    case "forsinkelsesrente":
      return ukjent("Kontroll av renter kommer senere.");
    case "rettsgebyr":
      return ukjent("Rettsgebyr kontrolleres ikke ennå.");
    case "annet":
      return ukjent("Ukjent kostnadstype.");
  }
}

/**
 * Vurderer alle kostnadslinjer mot satsversjonen som gjaldt på brevdatoen.
 * Brevdato før eldste kjente satsversjon → alle linjer «ukjent» (vi kan ikke
 * vurdere mot satser vi ikke har lagt inn).
 */
export function sjekkKostnader(
  linjer: Kostnadslinje[],
  hovedstol: number | null,
  brevdato: string | null,
): GebyrsjekkResultat {
  const eldste = versjonerSortert()[0];
  const forGammel = brevdato !== null && brevdato < eldste.gyldigFra;
  const sats = forGammel ? eldste : satserForDato(brevdato);

  const linjeResultater: LinjeResultat[] = linjer.map((linje) => {
    if (forGammel) {
      return {
        linje,
        vurdering: "ukjent",
        maksLav: null,
        maksHoy: null,
        differanse: null,
        forklaring: "Satsene fra brevets tid er ikke lagt inn ennå.",
      };
    }
    return vurderLinje(linje, hovedstol, sats);
  });

  return {
    satsGyldigFra: sats.gyldigFra,
    linjer: linjeResultater,
    antallOver: linjeResultater.filter((l) => l.vurdering === "over").length,
    antallMuligOver: linjeResultater.filter((l) => l.vurdering === "mulig_over")
      .length,
  };
}

const KOSTNADSNAVN: Record<Kostnadstype, string> = {
  purregebyr: "purregebyr",
  inkassovarselgebyr: "inkassovarselgebyr",
  betalingsoppfordringsgebyr: "betalingsoppfordringsgebyr",
  salaer: "inkassosalær",
  forsinkelsesrente: "forsinkelsesrente",
  rettsgebyr: "rettsgebyr",
  annet: "kostnad",
};

/**
 * Kodegenerert faktatekst om funn, til innsigelse-prompten. Tom streng når
 * ingen linjer er «over». Nevner kun «over»-linjer (ikke mulig_over/ukjent).
 */
export function gebyrFunnTekst(resultat: GebyrsjekkResultat): string {
  const overLinjer = resultat.linjer.filter((l) => l.vurdering === "over");
  if (overLinjer.length === 0) return "";

  const funn = overLinjer.map((l) => {
    const navn = KOSTNADSNAVN[l.linje.type];
    return `${navn} på ${kr(l.linje.belop)} kr overstiger høyeste lovlige sats (${kr(l.maksHoy as number)} kr) med ${kr(l.differanse as number)} kr`;
  });

  return `Automatisk kontroll mot inkassoforskriftens maksimalsatser (gjeldende fra ${kortDato(resultat.satsGyldigFra)}) fant: ${funn.join("; ")}.`;
}
