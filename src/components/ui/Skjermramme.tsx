import type { ReactNode } from "react";

/**
 * Skjermramme — sentrert kolonne, maks-bredde 640px, side-padding 20px.
 * Alle skjermer bor inni denne.
 */
export function Skjermramme({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[640px] px-5 ${className}`}>
      {children}
    </div>
  );
}
