import type { ReactNode } from "react";
import { VURDERING_PILL } from "@/lib/gebyrfunn-visning";
import type { LinjeResultat } from "@/lib/gebyr";

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
  prikk = false,
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  /** Liten statusprikk foran teksten (i tekstfargen), så fargen ikke er eneste signal. */
  prikk?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${varianter[variant]} ${className}`}
    >
      {prikk && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Vurderingspillen for én kostnadslinje (Innenfor, Kan være for høyt, N kr for mye, …). */
export function VurderingPill({ resultat, className = "" }: { resultat: LinjeResultat; className?: string }) {
  const pill = VURDERING_PILL[resultat.vurdering];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${pill.klasse} ${className}`}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {pill.tekst(resultat)}
    </span>
  );
}
