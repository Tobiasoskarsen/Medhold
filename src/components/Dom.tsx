// Dommen — signaturøyeblikket ved et gebyrfunn (designordre §2.1). Ren
// presentasjon av det lagrede gebyrsjekk-resultatet; ingen vurderingslogikk her.
import Link from "next/link";
import type { GebyrsjekkResultat, Kostnadstype, LinjeResultat } from "@/lib/gebyr";
import { formaterDato } from "@/lib/dato";

const TYPE_ORD: Record<Kostnadstype, string> = {
  purregebyr: "purregebyr",
  inkassovarselgebyr: "inkassovarselgebyr",
  betalingsoppfordringsgebyr: "betalingsoppfordringsgebyr",
  salaer: "salær",
  forsinkelsesrente: "forsinkelsesrente",
  rettsgebyr: "rettsgebyr",
  annet: "beløp",
};

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

function overLinjer(resultat: GebyrsjekkResultat): LinjeResultat[] {
  return resultat.linjer.filter((l) => l.vurdering === "over");
}

function totalOver(linjer: LinjeResultat[]): number {
  return linjer.reduce((sum, l) => sum + (l.differanse ?? 0), 0);
}

/** Ordet for funnet: kostnadstypen når det er ett funn, ellers «beløp». */
function funnOrd(linjer: LinjeResultat[]): string {
  return linjer.length === 1 ? TYPE_ORD[linjer[0].linje.type] : "beløp";
}

/**
 * Dom (full) — hvit flate, dom-rød ramme, stempel-etikett, differansen i stor
 * serif, forklaring, kilde og (når stadiet støtter utkast) CTA til innsigelsen.
 * Dekorativt §-tegn øverst til høyre (aria-hidden).
 */
export function Dom({
  resultat,
  utkastHref,
  className = "",
}: {
  resultat: GebyrsjekkResultat;
  utkastHref?: string;
  className?: string;
}) {
  const linjer = overLinjer(resultat);
  if (linjer.length === 0) return null;
  const total = totalOver(linjer);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-[1.5px] border-dom-rod bg-flate p-[18px] ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1.5 -top-7 select-none font-serif text-[130px] font-semibold leading-none text-dom-rod opacity-[0.07]"
      >
        §
      </span>

      <span className="relative inline-block rounded border border-dom-rod px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.14em] text-dom-rod">
        Gebyrsjekk · funn
      </span>

      <p className="relative mt-3 font-serif font-semibold leading-none text-dom-rod">
        <span className="text-[44px] tracking-[-0.02em] tabular-nums">
          {kr(total)}
        </span>
        <span className="text-[20px] font-medium"> kr over lovlig sats</span>
      </p>

      <p className="relative mt-2 text-[14px] leading-relaxed text-blekk">
        {linjer.map((l) => l.forklaring).join(" ")}
      </p>

      <p className="relative mt-2.5 text-[11.5px] text-dempet">
        Kontrollert mot offentlige maksimalsatser, gjeldende fra{" "}
        {formaterDato(resultat.satsGyldigFra)}.
      </p>

      {utkastHref && (
        <Link
          href={utkastHref}
          className="trykk relative mt-3.5 block w-full rounded-[10px] bg-aksent px-3 py-3 text-center text-sm font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2"
        >
          Bruk funnet i innsigelsen
        </Link>
      )}
    </div>
  );
}

/**
 * DomMini — kompakt variant på krav-detalj: §-tegn + kort setning på
 * dom-rød bakgrunn.
 */
export function DomMini({
  resultat,
  className = "",
}: {
  resultat: GebyrsjekkResultat;
  className?: string;
}) {
  const linjer = overLinjer(resultat);
  if (linjer.length === 0) return null;
  const total = totalOver(linjer);

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-[0.5px] border-dom-rod/40 bg-dom-rod-bg px-3.5 py-3 ${className}`}
    >
      <span
        aria-hidden
        className="select-none font-serif text-[24px] font-semibold leading-none text-dom-rod"
      >
        §
      </span>
      <p className="text-[13px] leading-snug text-blekk">
        Gebyrsjekken fant {funnOrd(linjer)}{" "}
        <b className="font-semibold text-dom-rod">
          {kr(total)} kr over maksimalsats
        </b>
        . Funnet er lagt klart til innsigelsen.
      </p>
    </div>
  );
}
