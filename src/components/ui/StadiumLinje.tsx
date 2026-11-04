"use client";

import { m } from "motion/react";
import { TRAPP_ETIKETTER, trappTrinn, type Stadium } from "@/lib/gjeld";
import { FJAER, STIGRING } from "@/lib/bevegelse";
import { useSekvensForsinkelse } from "./Sekvens";

/**
 * StadiumLinje — fire tynne segmenter for eskaleringstrinnene, med etikettene
 * under (Retning B §4.6). Erstatter StadiumRing på saken. Samme trinndata som
 * Trapp (`trappTrinn`/`TRAPP_ETIKETTER`). Segmentene vokser inn fra venstre
 * ved mount; redusert bevegelse følger MotionConfig i (app)-layout, som Trapp.
 */
export function StadiumLinje({
  stadium,
  className = "",
}: {
  stadium: Stadium;
  className?: string;
}) {
  const naa = trappTrinn(stadium);
  const kjedet = useSekvensForsinkelse();

  return (
    <div className={className}>
      <div className="grid grid-cols-4 gap-1">
        {TRAPP_ETIKETTER.map((etikett, i) => {
          const nr = i + 1;
          const farge =
            nr < naa
              ? "bg-aksent/40"
              : nr === naa
                ? "bg-aksent mork:shadow-[0_0_12px_#8fe3bf66]"
                : "bg-flate-2";
          return (
            <m.span
              key={etikett}
              className={`h-1.5 origin-left rounded-[3px] ${farge}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ ...FJAER, delay: kjedet + i * STIGRING }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium text-dempet">
        {TRAPP_ETIKETTER.map((etikett, i) => (
          <span
            key={etikett}
            className={i + 1 === naa ? "font-bold text-blekk" : ""}
          >
            {etikett}
          </span>
        ))}
      </div>
    </div>
  );
}
