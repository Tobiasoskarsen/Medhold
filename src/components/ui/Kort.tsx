import type { ReactNode } from "react";

/**
 * Kort — hvit flate, hårfin kant, radius 16px, padding 18px.
 * `klikkbar` gir trykk-respons (brukes når kortet ligger i en lenke).
 */
export function Kort({
  children,
  className = "",
  klikkbar = false,
}: {
  children: ReactNode;
  className?: string;
  klikkbar?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-[0.5px] border-strek bg-flate p-[18px] ${
        klikkbar ? "trykk" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
