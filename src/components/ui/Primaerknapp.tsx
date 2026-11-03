"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { NavLenke as Link } from "@/components/NavLenke";
import { haptikk } from "@/lib/haptikk";

const fokus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk focus-visible:ring-offset-2 focus-visible:ring-offset-bakgrunn disabled:opacity-60";
const basisFull = `trykk block w-full rounded-[16px] px-4 py-[15px] text-center text-[15px] font-bold ${fokus}`;
// `full={false}`: selvstørrende variant for sekundære bekreftelsesknapper ved
// siden av en tekstlenke (f.eks. «Ja, betalt» / «Avbryt»). Egen klassestreng
// i stedet for å overstyre w-full via className — Tailwinds genererte CSS
// respekterer IKKE className-strengens rekkefølge for utilities som styrer
// samme egenskap (verifisert under MEDHOLD_DELING_OG_OPPRYDDING).
const basisKompakt = `trykk inline-block w-auto rounded-[14px] px-4 py-2.5 text-center text-sm font-bold ${fokus}`;

// Fargevarianter (Retning B §4.2) — valgt som hele klassestrenger av samme
// grunn som over, aldri overstyrt via className. `gull` er lagt til for
// seier-heltekortet på Hjem («Del resultatet»): en `bg-gull`-className vinner
// ikke pålitelig over `bg-knapp`.
type Variant = "standard" | "lys" | "rolig" | "gull";
const VARIANT: Record<Variant, string> = {
  standard: "bg-knapp text-knapp-tekst",
  lys: "bg-helt-knapp text-helt-knapp-tekst",
  rolig: "border-[1.5px] border-strek bg-transparent text-blekk",
  gull: "bg-gull text-gull-tekst",
};

/**
 * Primærknapp — full bredde, fylt. Maks én `standard`/`lys` per skjerm.
 * Render som lenke ved `href`, ellers som knapp. Lett haptikk ved trykk.
 * `full={false}` gir en kompakt, selvstørrende variant (se `basisKompakt`).
 */
export function Primærknapp({
  children,
  href,
  className = "",
  full = true,
  variant = "standard",
  ...knappProps
}: {
  children: ReactNode;
  href?: string;
  className?: string;
  full?: boolean;
  variant?: Variant;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const basis = `${full ? basisFull : basisKompakt} ${VARIANT[variant]}`;
  if (href) {
    // Eksterne skjemaer (mailto:) skal ikke gjennom next/link-ruteren.
    if (href.startsWith("mailto:")) {
      return (
        <a
          href={href}
          className={`${basis} ${className}`}
          onPointerDown={() => haptikk("lett")}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href}
        className={`${basis} ${className}`}
        onPointerDown={() => haptikk("lett")}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      className={`${basis} ${className}`}
      onPointerDown={(e) => {
        if (!e.currentTarget.disabled) haptikk("lett");
      }}
      {...knappProps}
    >
      {children}
    </button>
  );
}
