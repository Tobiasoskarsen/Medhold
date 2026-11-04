import type { ReactNode } from "react";

type Variant = "noytral" | "varsel" | "suksess" | "feil" | "aksent";

const varianter: Record<Variant, string> = {
  noytral: "bg-strek text-dempet",
  varsel: "bg-varsel-bg text-varsel-tekst",
  // Blågrønn = «trygt/innenfor». Rød = funnfargen (dom-rod).
  suksess: "bg-trygg/10 text-trygg",
  feil: "bg-dom-rod-bg text-dom-rod",
  // «ANBEFALT»-merket i Veivalg — blekk-fylt (Retning B §2).
  aksent: "bg-blekk text-bakgrunn",
};

/**
 * Pill — liten statusetikett. `varsel` brukes til frister, `suksess`/`feil`
 * til status (f.eks. gebyrsjekk).
 */
export function Pill({
  children,
  variant = "noytral",
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${varianter[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
