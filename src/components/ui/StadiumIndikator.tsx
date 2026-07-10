"use client";

import { m } from "motion/react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

/**
 * StadiumIndikator — 5 avrundede striper. `fylt` segmenter i aksentfarge.
 * Ved mount fylles KUN det sist fylte segmentet (scaleX 0 → 1); tidligere
 * segmenter står ferdig fylt. Presentasjonelt for øvrig.
 */
export function StadiumIndikator({
  fylt,
  total = 5,
  stadium,
  neste,
}: {
  fylt: number;
  total?: number;
  stadium?: string;
  neste?: string;
}) {
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const erFylt = i < fylt;
          const sistFylte = i === fylt - 1;
          if (erFylt && sistFylte) {
            return (
              <div
                key={i}
                className="h-1 flex-1 overflow-hidden rounded-sm bg-strek"
              >
                <m.div
                  className="h-full w-full rounded-sm bg-aksent"
                  style={{ transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: VARIGHET.normal, ease: EASING }}
                />
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`h-1 flex-1 rounded-sm ${erFylt ? "bg-aksent" : "bg-strek"}`}
            />
          );
        })}
      </div>
      {stadium && (
        <p className="mt-1.5 text-xs text-dempet">
          Stadium: {stadium}
          {neste ? ` · neste er ${neste}` : ""}
        </p>
      )}
    </div>
  );
}
