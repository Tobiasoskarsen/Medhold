"use client";

// «Hvordan vi regnet dette ut» (MEDHOLD_SUBSTANS_ARBEIDSORDRE §3) — et
// utvidbart panel som viser utregningen bak et gebyrfunn eller en beregnet
// frist. Gjenbruker Utvidbar sin høyde/opasitet-mekanikk (meg/Utvidbar.tsx),
// men med en enkel tekstknapp i stedet for ikon+etikett-raden der.
import { useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import type { UtregningRad } from "@/lib/gebyr";

export function Utregning({
  rader,
  kildelinje,
  /** Farge på den uthevede (siste) raden — dom-rod kun ved et ekte «over»-funn. */
  uthevetFarge = "noytral",
  trigger = "Hvordan regnet vi dette ut?",
  className = "",
}: {
  rader: UtregningRad[];
  kildelinje?: ReactNode;
  uthevetFarge?: "dom-rod" | "noytral";
  trigger?: string;
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  if (rader.length === 0) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setÅpen((o) => !o)}
        aria-expanded={åpen}
        className="trykk flex items-center gap-1 text-[13px] font-medium text-dempet transition hover:text-blekk"
      >
        {trigger}
        <ChevronDown
          className={`size-[15px] transition-transform duration-200 ${
            åpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {/* Reduced motion følger MotionConfig (samme mønster som Utvidbar). */}
      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="utregning"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <dl className="mt-3 flex flex-col gap-2 rounded-xl border-[0.5px] border-strek bg-flate p-3.5">
              {rader.map((r, i) => (
                <div
                  key={i}
                  className="flex items-baseline justify-between gap-3 text-[13px]"
                >
                  <dt className="text-dempet">{r.etikett}</dt>
                  <dd
                    className={`shrink-0 tabular-nums ${
                      r.uthevet
                        ? `font-semibold ${
                            uthevetFarge === "dom-rod"
                              ? "text-dom-rod"
                              : "text-blekk"
                          }`
                        : "text-blekk"
                    }`}
                  >
                    {r.verdi}
                  </dd>
                </div>
              ))}
            </dl>
            {kildelinje}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
