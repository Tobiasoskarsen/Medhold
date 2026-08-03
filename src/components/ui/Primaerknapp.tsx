"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { NavLenke as Link } from "@/components/NavLenke";
import { haptikk } from "@/lib/haptikk";

const basisFull =
  "trykk block w-full rounded-[10px] bg-aksent px-3 py-3 text-center text-sm font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";
// `full={false}`: selvstørrende variant for sekundære bekreftelsesknapper ved
// siden av en tekstlenke (f.eks. «Ja, betalt» / «Avbryt»). Egen klassestreng
// i stedet for å overstyre w-full via className — Tailwinds genererte CSS
// respekterer IKKE className-strengens rekkefølge for utilities som styrer
// samme egenskap (w-auto etter w-full i klassenavnet vant ikke i praksis,
// verifisert i browser under MEDHOLD_DELING_OG_OPPRYDDING-verifiseringen).
const basisKompakt =
  "trykk inline-block w-auto rounded-[10px] bg-aksent px-4 py-2.5 text-center text-sm font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";

/**
 * Primærknapp — full bredde, aksentfarge, hvit tekst. Maks én per skjerm.
 * Render som lenke ved `href`, ellers som knapp. Lett haptikk ved trykk.
 * `full={false}` gir en kompakt, selvstørrende variant (se `basisKompakt`).
 */
export function Primærknapp({
  children,
  href,
  className = "",
  full = true,
  ...knappProps
}: {
  children: ReactNode;
  href?: string;
  className?: string;
  full?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const basis = full ? basisFull : basisKompakt;
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
