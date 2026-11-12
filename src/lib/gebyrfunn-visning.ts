// Ren presentasjons-utledning av et lagret GebyrsjekkResultat — ingen
// vurderingslogikk. Delt av Dom.tsx (Dom/DomMini) og DomFullskjerm.tsx
// (Del C) — egen fil for å unngå en sirkulær import mellom de to
// («use client»-komponenten Dom.tsx importerer DomFullskjerm, og
// DomFullskjerm trenger samme utledning).
import type { GebyrsjekkResultat, Kostnadstype, LinjeResultat, Vurdering } from "./gebyr.ts";
import { KOSTNADSTYPE_ETIKETT, UKJENT_ARSAK } from "./gebyr.ts";
import type { Sumavvik } from "./sumkontroll.ts";
import { formaterKr } from "./format.ts";

const TYPE_ORD: Record<Kostnadstype, string> = {
  purregebyr: "purregebyr",
  inkassovarselgebyr: "inkassovarselgebyr",
  betalingsoppfordringsgebyr: "betalingsoppfordringsgebyr",
  salaer: "salær",
  forsinkelsesrente: "forsinkelsesrente",
  rettsgebyr: "rettsgebyr",
  annet: "beløp",
};

export function kr(n: number): string {
  return formaterKr(n);
}

export function overLinjer(resultat: GebyrsjekkResultat): LinjeResultat[] {
  return resultat.linjer.filter((l) => l.vurdering === "over");
}

export function totalOver(linjer: LinjeResultat[]): number {
  return linjer.reduce((sum, l) => sum + (l.differanse ?? 0), 0);
}

/** Ordet for funnet: kostnadstypen når det er ett funn, ellers «beløp». */
export function funnOrd(linjer: LinjeResultat[]): string {
  return linjer.length === 1 ? TYPE_ORD[linjer[0].linje.type] : "beløp";
}

// --- Samme språk i kontrollsteget og på brevvisningen (Del E) ---------------
// Ordet «merknad» brukes ikke: en linje er innenfor, for høy, kan være for høy
// eller ikke sjekket.

/**
 * Kort pilletekst for en linje vi ikke kunne vurdere: årsaken når den er kjent
 * og kort, ellers «Ikke sjekket».
 */
export function ukjentPille(forklaring: string): string {
  switch (forklaring) {
    case UKJENT_ARSAK.manglerStadium:
      return "Mangler stadium";
    case UKJENT_ARSAK.stadiumUklart:
      return "Stadium uklart";
    case UKJENT_ARSAK.ikkeKjentSats:
      return "Samsvarer ikke med kjent sats";
    case UKJENT_ARSAK.manglerDato:
      return "Mangler dato";
    case UKJENT_ARSAK.renteperiodeMangler:
      return "Periode ikke lagt inn";
    case UKJENT_ARSAK.ugyldigPeriode:
      return "Ugyldig periode";
    default:
      return "Ikke sjekket";
  }
}

/** Pillen for hver vurdering. Klassene er eksisterende tokens (som Pill). */
export const VURDERING_PILL: Record<Vurdering, { klasse: string; tekst: (l: LinjeResultat) => string }> = {
  innenfor: { klasse: "bg-trygg/10 text-trygg", tekst: () => "Innenfor" },
  over: {
    klasse: "bg-dom-rod-bg text-dom-rod",
    tekst: (l) => (l.differanse !== null ? `${kr(l.differanse)} kr for mye` : "For høyt"),
  },
  mulig_over: { klasse: "bg-varsel-bg text-varsel-tekst", tekst: () => "Kan være for høyt" },
  ukjent: { klasse: "bg-flate-2 text-dempet", tekst: (l) => ukjentPille(l.forklaring) },
};

/** Navnet på det vi ikke sjekker ennå, i setningen under «Gebyrsjekken». */
const IKKE_SJEKKET_NAVN: Partial<Record<Kostnadstype, string>> = {
  forsinkelsesrente: "Renter",
  rettsgebyr: "Rettsgebyr",
  annet: "Andre kostnader",
};

function ikkeSjekketNavn(type: Kostnadstype): string {
  return IKKE_SJEKKET_NAVN[type] ?? KOSTNADSTYPE_ETIKETT[type];
}

/**
 * Én setning i vanlig språk om gebyrsjekken, kodegenerert fra vurderingene.
 * Første regel som treffer: noe over, noe som kan være over, noe innenfor,
 * ingenting sjekket. Linjer vi ikke sjekker, nevnes til slutt.
 */
export function gebyrsjekkSetning(linjer: LinjeResultat[]): string {
  const antall = (v: Vurdering) => linjer.filter((l) => l.vurdering === v).length;
  const o = antall("over");
  const m = antall("mulig_over");
  const k = antall("innenfor");
  const hoved =
    o >= 1
      ? o === 1
        ? "Ett gebyr er høyere enn loven tillater."
        : `${o} gebyrer er høyere enn loven tillater.`
      : m >= 1
        ? m === 1
          ? "Ingen gebyrer er over grensen for alle saker, men ett kan være for høyt."
          : `Ingen gebyrer er over grensen for alle saker, men ${m} kan være for høye.`
        : k >= 1
          ? "Gebyrene vi kunne sjekke, er innenfor det loven tillater."
          : "Vi kunne ikke sjekke noen av kostnadene i dette brevet.";
  const navn = [...new Set(linjer.filter((l) => l.vurdering === "ukjent").map((l) => ikkeSjekketNavn(l.linje.type)))];
  if (navn.length === 0) return hoved;
  const liste = navn.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1))).join(" og ");
  return `${hoved} ${liste} sjekker vi ikke ennå.`;
}

/** Teksten i sumfunnkortet (Del B.2). Ordrett fra arbeidsordren. */
export function sumavvikTekst(s: Sumavvik): { etikett: string; tall: string; tekst: string } {
  return {
    etikett: "Beløpskontroll",
    tall: `${kr(s.differanse)} kr uten forklaring`,
    tekst: `Brevet krever ${kr(s.total)} kr, men hovedstol og kostnader blir ${kr(s.sum)} kr. Be kreditor forklare differansen før du betaler den.`,
  };
}

/** Kort linje på Hjem under gebyrlinjen (Del B.2). */
export function sumavvikLinje(s: Sumavvik): string {
  return `Beløpskontroll: ${kr(s.differanse)} kr uten forklaring`;
}

/** Nøytral setning når linjene blir MER enn totalen (Del B.3). Ikke et funn. */
export function sumOverTotalTekst(sum: number, total: number): string {
  return `Hovedstol og kostnader blir ${kr(sum)} kr, mer enn de ${kr(total)} kr brevet krever. Betal aldri mer enn brevet krever.`;
}
