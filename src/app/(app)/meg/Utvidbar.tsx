"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * Utvidbar rad (progressive disclosure): trykk åpner/lukker innholdet under med
 * høyde/opacity-animasjon på motion-tokens; chevron roterer 90°. Lukket ved
 * sidelast (ingen layout-hopp). Reduced motion følger MotionConfig i (app).
 */
export function Utvidbar({
  ikon: Ikon,
  etikett,
  verdi,
  children,
}: {
  ikon: LucideIcon;
  etikett: string;
  verdi?: string;
  children: ReactNode;
}) {
  const [åpen, setÅpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setÅpen((o) => !o)}
        aria-expanded={åpen}
        className="trykk flex w-full items-center justify-between gap-3 px-[14px] py-3 text-left"
      >
        <span className="flex items-center gap-2.5 text-sm text-blekk">
          <Ikon className="size-[17px] shrink-0 text-dempet" aria-hidden />
          {etikett}
        </span>
        <span className="flex items-center gap-1.5">
          {verdi && <span className="text-[13px] text-dempet">{verdi}</span>}
          <ChevronRight
            className={`size-[15px] shrink-0 text-dempet transition-transform duration-200 ${
              åpen ? "rotate-90" : ""
            }`}
            aria-hidden
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="innhold"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-[14px] pb-4 pt-1">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
