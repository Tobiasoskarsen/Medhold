"use client";

import { m } from "motion/react";
import type { Stadium } from "@/lib/gjeld";
import { EASING, VARIGHET, STIGRING } from "@/lib/bevegelse";

/**
 * Trapp — appens identitetsmotiv: fire stigende søyler for inkasso-
 * eskaleringen (Varsel → Oppfordring → Forliksråd → Namsmann). Passerte trinn
 * i lys aksent, nåværende i full aksent, kommende i strek. `kompakt` (uten
 * etiketter) brukes på sakskortene på Hjem.
 *
 * Søylene vokser inn (scaleY 0→1 fra bunnlinjen) med stagger, én gang ved
 * mount (Motion2 §3); etikettene fader inn etter siste søyle. Reduced motion
 * (MotionConfig i (app)-layout) → vises ferdig uten animasjon.
 *
 * Presentasjon — endrer ikke gjeld-logikken (fylteSegmenter står urørt).
 */
const ETIKETTER = ["Varsel", "Oppfordring", "Forliksråd", "Namsmann"] as const;
const HOYDER = ["h-[9px]", "h-[15px]", "h-[21px]", "h-[26px]"];
const HOYDER_KOMPAKT = ["h-[8px]", "h-[13px]", "h-[18px]", "h-[22px]"];

/** Hvilket av de fire trinnene som er «nå» (1–4). Tidlige stadier og selve
 *  inkassovarselet ligger på trinn 1; nedbetaling/avsluttet på siste. */
function naaTrinn(stadium: Stadium): number {
  switch (stadium) {
    case "faktura":
    case "purring":
    case "inkassovarsel":
      return 1;
    case "betalingsoppfordring":
      return 2;
    case "forliksrad":
      return 3;
    case "namsmann":
    case "nedbetaling":
    case "avsluttet":
      return 4;
  }
}

export function Trapp({
  stadium,
  kompakt = false,
}: {
  stadium: Stadium;
  kompakt?: boolean;
}) {
  const naa = naaTrinn(stadium);
  const hoyder = kompakt ? HOYDER_KOMPAKT : HOYDER;

  return (
    <div>
      <div className={`flex items-end gap-1.5 ${kompakt ? "h-[22px]" : "h-[26px]"}`}>
        {ETIKETTER.map((_, i) => {
          const nr = i + 1;
          const farge =
            nr < naa ? "bg-aksent/30" : nr === naa ? "bg-aksent" : "bg-strek";
          return (
            <m.span
              key={i}
              className={`flex-1 origin-bottom rounded-[3px] ${hoyder[i]} ${farge}`}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                duration: VARIGHET.normal,
                ease: EASING,
                delay: i * STIGRING,
              }}
            />
          );
        })}
      </div>
      {!kompakt && (
        <m.div
          className="mt-1.5 flex justify-between text-[10.5px] text-dempet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: VARIGHET.normal,
            ease: EASING,
            delay: ETIKETTER.length * STIGRING,
          }}
        >
          {ETIKETTER.map((etikett, i) => (
            <span
              key={etikett}
              className={i + 1 === naa ? "font-semibold text-aksent-dyp" : ""}
            >
              {etikett}
            </span>
          ))}
        </m.div>
      )}
    </div>
  );
}
