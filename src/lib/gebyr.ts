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

import { idagOslo } from "./dato.ts";
import { formaterKr } from "./format.ts";

/** Én versjon av satstabellen, gyldig i et avgrenset tidsrom. */
export type Satsversjon = {
  gyldigFra: string; // ISO-dato, f.eks. "2026-01-01"
  // Siste gyldige dag. Etter denne finnes det ingen satser før en ny versjon
  // er lagt inn (se «Årlig satsoppdatering» i PROSJEKT_STATUS.md) — appen sier
  // da «ukjent» i stedet for å vurdere mot fjorårets tall.
  gyldigTil: string;
  kilde: string; // URL til Finanstilsynet
  inkassosats: number;
  purregebyr: number;
  inkassovarselGebyr: number;
  betalingsoppfordringGebyr: number; // egeninkasso
  /** Rettsgebyret R i kroner for året (domstol.no). Grunnlaget for rettsgebyrSatser. */
  rettsgebyr: number;
  /** Kjente rettsgebyrer en kreditor kan ha lagt inn, utledet av R (se rettsgebyrSatserFor). */
  rettsgebyrSatser: Array<{ navn: string; belop: number }>;
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

// Rettsgebyr (rettsgebyrloven). Multiplene er bekreftet mot Lovdata 2026-11-11:
//   forliksklage            1,54 R  (§ 7)   https://lovdata.no/lov/1982-12-17-86
//   begjæring om utlegg     0,69 R  (§ 14)  https://lovdata.no/nav/lov/1982-12-17-86/kap4/%C2%A714
//   avrunding               ned til nærmeste krone (§ 6 a)
// R 2026 = 1 345 kr (https://www.domstol.no/no/rettsgebyr-og-kostnader).
// Begjæring om tvangsfullbyrdelse står bare som beløp (1 479 kr) hos domstol.no,
// verifisert 2026-11-11. Multippelen i loven er IKKE bekreftet, så beløpet
// er knyttet til 2026-versjonen og regnes ikke ut av R.
const LOVDATA_RETTSGEBYRLOVEN = "https://lovdata.no/lov/1982-12-17-86";

/** Multipler i hundredeler, så avrundingen blir eksakt (ingen flyttallsfeil). */
const FORLIKSKLAGE_HUNDREDELER = 154;
const UTLEGG_HUNDREDELER = 69;

/** Beløp = multippel × R, rundet NED til nærmeste krone (rettsgebyrloven § 6 a). */
function rettsgebyrBelop(hundredeler: number, r: number): number {
  return Math.floor((hundredeler * r) / 100);
}

/** De kjente rettsgebyrene for et gitt R. Fast beløp for tvangsfullbyrdelse følger med bare for R = 1 345. */
export function rettsgebyrSatserFor(
  r: number,
  tvangsfullbyrdelse: number | null = null,
): Array<{ navn: string; belop: number }> {
  return [
    { navn: "forliksklage", belop: rettsgebyrBelop(FORLIKSKLAGE_HUNDREDELER, r) },
    { navn: "begjæring om utlegg", belop: rettsgebyrBelop(UTLEGG_HUNDREDELER, r) },
    ...(tvangsfullbyrdelse !== null
      ? [{ navn: "begjæring om tvangsfullbyrdelse", belop: tvangsfullbyrdelse }]
      : []),
  ];
}

/** Kilder for rettsgebyr, vist ved siden av satsene. */
export const RETTSGEBYR_KILDER = { domstol: "https://www.domstol.no/no/rettsgebyr-og-kostnader", lov: LOVDATA_RETTSGEBYRLOVEN } as const;

/**
 * Rettsgebyr kan først kreves når saken er brakt inn for forliksrådet eller
 * namsmannen. Reglen gjelder «mulig_over» (aldri «over») og krever juridisk
 * bekreftelse før den slås på for brukerne. Sett til false for å vise «ukjent».
 */
export const RETTSGEBYR_FOER_RETT_ER_MULIG_OVER = true;

/** Stadier før saken er brakt inn for retten. */
const STADIER_FOER_RETT = ["faktura", "purring", "inkassovarsel", "betalingsoppfordring"];
/** Stadier der rettsgebyr kan være aktuelt. */
const STADIER_RETT = ["forliksrad", "namsmann"];

/**
 * Årsakene til at en linje er «ukjent», som korte tekster i pillen. Forklaringen
 * på linjen er den lange teksten; pillen viser kortversjonen.
 */
export const UKJENT_ARSAK = {
  manglerStadium: "Rettsgebyr kan ikke vurderes uten kjent stadium i saken.",
  stadiumUklart:
    "Brevtypen sier ikke om saken er brakt inn for retten. Kontroller mot domstol.no.",
  ikkeKjentSats:
    "Beløpet samsvarer ikke med en kjent sats; kontroller mot domstol.no.",
} as const;

export const SATSVERSJONER: Satsversjon[] = [
  {
    gyldigFra: "2026-01-01",
    gyldigTil: "2026-12-31",
    kilde: FINANSTILSYNET_URL,
    inkassosats: 750,
    purregebyr: 38,
    inkassovarselGebyr: 38,
    betalingsoppfordringGebyr: 113,
    rettsgebyr: 1345,
    rettsgebyrSatser: rettsgebyrSatserFor(1345, 1479),
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
 * Satsversjonen der gyldigFra <= dato <= gyldigTil, ellers null. Dato
 * mangler → dagens dato (norsk tid). ALDRI «nyeste versjon uansett»: et brev
 * fra et år uten innlagte satser skal gi «ukjent», ikke en vurdering mot
 * feil års tall.
 */
export function satserForDato(dato: string | null): Satsversjon | null {
  const d = dato ?? idagOslo();
  return (
    versjonerSortert().find((v) => v.gyldigFra <= d && d <= v.gyldigTil) ??
    null
  );
}

export const KOSTNADSTYPE_ETIKETT: Record<Kostnadstype, string> = {
  purregebyr: "Purregebyr",
  inkassovarselgebyr: "Inkassovarselgebyr",
  betalingsoppfordringsgebyr: "Betalingsoppfordringsgebyr",
  salaer: "Inkassosalær",
  forsinkelsesrente: "Forsinkelsesrente",
  rettsgebyr: "Rettsgebyr",
  annet: "Annen kostnad",
};

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
  // Satsversjonen som ble brukt. Når satserMangler er satt, er dette
  // nærmeste kjente versjon (kun for visning) — ingen linje er vurdert mot den.
  satsGyldigFra: string;
  linjer: LinjeResultat[];
  antallOver: number;
  antallMuligOver: number;
  /** Ingen satsversjon dekker brevdatoen → alle linjer «ukjent». */
  satserMangler?: boolean;
  /** Brevet manglet dato → dagens satser er lagt til grunn. */
  brevdatoAntatt?: boolean;
};

// 1 kr slingring på alle grenser (avrunding i brevet skal ikke gi falsk «over»).
const SLINGRING = 1;

/** Norsk beløp med tusenskille, opptil to desimaler (for tekst). */
function kr(belop: number): string {
  return formaterKr(belop);
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
  stadium: string | null = null,
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
    case "rettsgebyr": {
      // Aldri «over» for rettsgebyr i v1: bare «innenfor», «mulig_over» eller «ukjent».
      if (!stadium) return ukjent(UKJENT_ARSAK.manglerStadium);
      if (STADIER_FOER_RETT.includes(stadium)) {
        if (!RETTSGEBYR_FOER_RETT_ER_MULIG_OVER) return ukjent(UKJENT_ARSAK.stadiumUklart);
        return {
          linje,
          vurdering: "mulig_over",
          maksLav: null,
          maksHoy: null,
          differanse: null,
          forklaring:
            "Rettsgebyr kan først kreves når saken er brakt inn for forliksrådet eller namsmannen.",
        };
      }
      if (!STADIER_RETT.includes(stadium)) return ukjent(UKJENT_ARSAK.stadiumUklart);
      // Nærmeste kjente sats innenfor slingringen.
      const treff = sats.rettsgebyrSatser
        .filter((s) => Math.abs(linje.belop - s.belop) <= SLINGRING)
        .sort((a, b) => Math.abs(linje.belop - a.belop) - Math.abs(linje.belop - b.belop))[0];
      if (!treff) return ukjent(UKJENT_ARSAK.ikkeKjentSats);
      return {
        linje,
        vurdering: "innenfor",
        maksLav: treff.belop,
        maksHoy: treff.belop,
        differanse: null,
        forklaring: `Tilsvarer ${treff.navn} (${kr(treff.belop)} kr).`,
      };
    }
    case "annet":
      return ukjent("Ukjent kostnadstype.");
  }
}

/**
 * Vurderer alle kostnadslinjer mot satsversjonen som gjaldt på brevdatoen.
 * Ingen versjon dekker datoen → alle linjer «ukjent» (vi kan ikke vurdere mot
 * satser vi ikke har lagt inn). Brevdato mangler → dagens dato, og
 * resultatet merkes `brevdatoAntatt`.
 */
export function sjekkKostnader(
  linjer: Kostnadslinje[],
  hovedstol: number | null,
  brevdato: string | null,
  /** Brevtypen/stadiet (faktura … namsmann). Null = ukjent stadium. */
  stadium: string | null = null,
): GebyrsjekkResultat {
  const dato = brevdato || idagOslo();
  const brevdatoAntatt = !brevdato;
  const sats = satserForDato(dato);

  if (!sats) {
    const sortert = versjonerSortert();
    const forGammel = dato < sortert[0].gyldigFra;
    const forklaring = forGammel
      ? "Satsene fra brevets tid er ikke lagt inn ennå."
      : `Satsene for ${dato.slice(0, 4)} er ikke lagt inn ennå, så vi kan ikke vurdere gebyrene.`;
    return {
      satsGyldigFra: (forGammel ? sortert[0] : sortert[sortert.length - 1])
        .gyldigFra,
      linjer: linjer.map((linje) => ({
        linje,
        vurdering: "ukjent",
        maksLav: null,
        maksHoy: null,
        differanse: null,
        forklaring,
      })),
      antallOver: 0,
      antallMuligOver: 0,
      satserMangler: true,
      ...(brevdatoAntatt ? { brevdatoAntatt } : {}),
    };
  }

  const linjeResultater = linjer.map((linje) =>
    vurderLinje(linje, hovedstol, sats, stadium),
  );

  return {
    satsGyldigFra: sats.gyldigFra,
    linjer: linjeResultater,
    antallOver: linjeResultater.filter((l) => l.vurdering === "over").length,
    antallMuligOver: linjeResultater.filter((l) => l.vurdering === "mulig_over")
      .length,
    ...(brevdatoAntatt ? { brevdatoAntatt } : {}),
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

// --- «Hvordan vi regnet dette ut» (MEDHOLD_SUBSTANS_ARBEIDSORDRE §3) ---

/**
 * Salærtrinnets øvre hovedstol-grense som lesbar norsk tekst, f.eks.
 * «t.o.m. 2 500 kr» for et vanlig trinn, eller «over 250 000 kr» for det
 * øverste (hovedstolTom === null). Rent presentasjonsoppslag — gjør ALDRI om
 * på hvilket trinn som allerede er lagt til grunn for vurderingen.
 */
export function trinnEtikett(hovedstol: number, sats: Satsversjon): string {
  const trinn = finnSalaertrinn(sats, hovedstol);
  if (trinn.hovedstolTom !== null) return `t.o.m. ${kr(trinn.hovedstolTom)} kr`;
  const grenser = sats.salaerForbruker
    .map((t) => t.hovedstolTom)
    .filter((g): g is number => g !== null);
  return `over ${kr(Math.max(...grenser))} kr`;
}

export type UtregningRad = {
  etikett: string;
  verdi: string;
  /** Siste, konkluderende rad — fremhevet i visningen. */
  uthevet?: boolean;
};

/**
 * Bygger radene i «Hvordan regnet vi dette ut»-panelet for én kostnadslinje,
 * KUN fra tall som allerede finnes i det lagrede `LinjeResultat` (og —
 * `hovedstol`, når den er kjent — selve grunnlaget salærtrinnet slås opp
 * fra). Regner ALDRI om vurderingen; mangler et tall, utelates raden
 * (guardrail 3). Kun 'over'/'mulig_over' har noe å vise — andre gir null.
 */
export function utregningRaderForLinje(
  l: LinjeResultat,
  sats: Satsversjon,
  hovedstol: number | null,
): UtregningRad[] | null {
  if (l.vurdering !== "over" && l.vurdering !== "mulig_over") return null;
  // Rettsgebyr har ingen utregning å vise: forklaringen på linjen sier alt.
  if (l.linje.type === "rettsgebyr") return null;

  const rader: UtregningRad[] = [];
  if (l.linje.type === "salaer") {
    if (hovedstol !== null) {
      rader.push({ etikett: "Hovedstol i brevet", verdi: `${kr(hovedstol)} kr` });
      rader.push({ etikett: "Salærtrinn", verdi: trinnEtikett(hovedstol, sats) });
    }
    if (l.maksLav !== null) {
      rader.push({ etikett: "Laveste lovlige sats", verdi: `${kr(l.maksLav)} kr` });
    }
    if (l.maksHoy !== null) {
      rader.push({ etikett: "Høyeste lovlige sats", verdi: `${kr(l.maksHoy)} kr` });
    }
    rader.push({ etikett: "Krevd i brevet", verdi: `${kr(l.linje.belop)} kr` });
    if (l.vurdering === "over" && l.differanse !== null) {
      rader.push({ etikett: "Over høyeste sats", verdi: `${kr(l.differanse)} kr` });
    }
  } else {
    // Faste gebyrer (purregebyr/inkassovarselgebyr/betalingsoppfordringsgebyr).
    if (l.maksHoy !== null) {
      rader.push({ etikett: "Maksimalsats", verdi: `${kr(l.maksHoy)} kr` });
    }
    rader.push({ etikett: "Krevd", verdi: `${kr(l.linje.belop)} kr` });
    if (l.vurdering === "over" && l.differanse !== null) {
      rader.push({ etikett: "Over", verdi: `${kr(l.differanse)} kr` });
    }
  }

  if (rader.length > 0) rader[rader.length - 1].uthevet = true;
  return rader;
}
