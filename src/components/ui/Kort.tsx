import type { ReactNode } from "react";

/**
 * Kort — hvit flate, hårfin kant, radius 16px, padding 18px.
 */
export function Kort({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border-[0.5px] border-strek bg-flate p-[18px] ${className}`}
    >
      {children}
    </div>
  );
}
