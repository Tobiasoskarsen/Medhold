"use client";

import { useState, type ComponentProps } from "react";
import { AnimatePresence, m } from "motion/react";
import { EASING, INNTREDEN, STIGRING, VARIGHET } from "@/lib/bevegelse";
import { Kravkort } from "./Kravkort";

const SYNLIG_UTEN_UTVIDELSE = 4;

/**
 * Den flate, ugrupperte aktiv-listen (under GRUPPERING_TERSKEL): viser de 4
 * første (nærmeste frist/nyest, allerede sortert av kalleren), med en
 * dempet, stiplet knapp som veksler resten av og på (ny saksliste-mockup +
 * brukerens oppfølging om å kunne skjule igjen). Nyavslørte kort toner inn
 * stagget med appens INNTREDEN/STIGRING-tokens; skjulte kort toner ut med
 * samme form i revers. Allerede synlige kort animerer aldri på nytt ved
 * (ut)utvidelse — kun de fire første er alltid `initial={false}`.
 */
export function AktivSaksliste({
  saker,
}: {
  saker: ComponentProps<typeof Kravkort>[];
}) {
  const [visAlle, setVisAlle] = useState(false);
  const synlige = visAlle ? saker : saker.slice(0, SYNLIG_UTEN_UTVIDELSE);
  const skjulteAntall = saker.length - SYNLIG_UTEN_UTVIDELSE;

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {synlige.map((sak, i) => {
            const utenforFasteFire = i >= SYNLIG_UTEN_UTVIDELSE;
            return (
              <m.li
                key={sak.id}
                initial={utenforFasteFire ? INNTREDEN.initial : false}
                animate={INNTREDEN.animate}
                exit={utenforFasteFire ? INNTREDEN.initial : undefined}
                transition={{
                  duration: VARIGHET.normal,
                  ease: EASING,
                  delay: utenforFasteFire ? (i - SYNLIG_UTEN_UTVIDELSE) * STIGRING : 0,
                }}
              >
                <Kravkort {...sak} />
              </m.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {skjulteAntall > 0 && (
        <button
          type="button"
          onClick={() => setVisAlle((v) => !v)}
          className="trykk mt-2.5 w-full rounded-[14px] border border-dashed border-strek py-3 text-center text-[13px] font-semibold text-dempet transition hover:text-blekk"
        >
          {visAlle ? "Vis færre" : `Vis ${skjulteAntall} til`}
        </button>
      )}
    </>
  );
}
