import type { ReactNode } from "react";

type Variant = "noytral" | "varsel";

const varianter: Record<Variant, string> = {
  noytral: "bg-strek text-dempet",
  varsel: "bg-varsel-bg text-varsel-tekst",
};

/**
 * Pill — liten statusetikett. `varsel`-varianten brukes til frister.
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
