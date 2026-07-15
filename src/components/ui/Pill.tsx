import type { ReactNode } from "react";

type Variant = "noytral" | "varsel" | "suksess" | "feil";

const varianter: Record<Variant, string> = {
  noytral: "bg-strek text-dempet",
  varsel: "bg-varsel-bg text-varsel-tekst",
  // Grønn = aksent-token (følger tema). Rød = appens etablerte feilfarge
  // (samme som HASTEGRAD_STIL.overtid), lys pill lesbar i begge tema.
  suksess: "bg-aksent/10 text-aksent",
  feil: "bg-red-50 text-red-700",
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
