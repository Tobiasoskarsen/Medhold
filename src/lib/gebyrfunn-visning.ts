// Ren presentasjons-utledning av et lagret GebyrsjekkResultat — ingen
// vurderingslogikk. Delt av Dom.tsx (Dom/DomMini) og DomFullskjerm.tsx
// (Del C) — egen fil for å unngå en sirkulær import mellom de to
// («use client»-komponenten Dom.tsx importerer DomFullskjerm, og
// DomFullskjerm trenger samme utledning).
import type { GebyrsjekkResultat, Kostnadstype, LinjeResultat } from "@/lib/gebyr";

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
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
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
