import type { ReactNode } from "react";

/**
 * Kort — hvit flate, radius 20px, padding 18px. Kanten (`--kant`) er kun
 * synlig i mørk modus.
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
      className={`rounded-[20px] border border-kant bg-flate p-[18px] ${
        klikkbar ? "trykk" : ""
      } ${className}`}
      style={{ boxShadow: "var(--kort-skygge)" }}
    >
      {children}
    </div>
  );
}
