"use client";

import type { CSSProperties } from "react";
import { m } from "motion/react";
import { EASING, TRAPP_STIGRING, VARIGHET } from "@/lib/bevegelse";
import { useForstegangsvisning } from "./useForstegangsvisning";

/**
 * Steg 2 — fire søyler, andre uthevet i aksent (dekorativ illustrasjon, ikke
 * den ekte Trapp-komponenten — onboarding har ingen sak å vise stadium for).
 * Tekst ordrett fra mockup.
 *
 * Søylene vokser inn med EKSAKT samme verdier som Trapp.tsx (VARIGHET.trapp,
 * TRAPP_STIGRING, EASING — Motion3 §4.2) idet steget vises for FØRSTE gang
 * (useForstegangsvisning — steget er allerede mounted, men skjult, når
 * brukeren først bytter til det).
 */
const HOYDER = [34, 56, 80, 104];

export function TrappSteg({
  aktiv,
  illustrasjonStil,
  tekstStil,
}: {
  aktiv: boolean;
  illustrasjonStil: CSSProperties;
  tekstStil: CSSProperties;
}) {
  const vist = useForstegangsvisning(aktiv);

  return (
    <>
      <div style={illustrasjonStil}>
        <div className="flex size-[180px] items-end justify-center">
          <div className="flex h-[120px] items-end gap-2">
            {HOYDER.map((h, i) => (
              <m.span
                key={i}
                className={`w-[26px] origin-bottom rounded-[6px] ${
                  i === 1 ? "bg-aksent" : "bg-strek"
                }`}
                style={{ height: h }}
                initial={{ scaleY: 0 }}
                animate={vist ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{
                  duration: VARIGHET.trapp,
                  ease: EASING,
                  delay: i * TRAPP_STIGRING,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={tekstStil}>
        <h1 className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk">
          Vi finner ut
          <br />
          <em className="italic text-aksent-dyp">hvor du står</em>
        </h1>
        <p className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet">
          Fristen din regnes ut automatisk, og vi viser nøyaktig hvor i
          prosessen saken befinner seg — ingen overraskelser.
        </p>
      </div>
    </>
  );
}
