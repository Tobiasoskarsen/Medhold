"use client";

import { useState, type ComponentProps } from "react";
import { m } from "motion/react";
import { EASING, INNTREDEN, STIGRING, VARIGHET } from "@/lib/bevegelse";
import { Kravkort } from "./Kravkort";

const SYNLIG_UTEN_UTVIDELSE = 4;

/**
 * Den flate, ugrupperte aktiv-listen (under GRUPPERING_TERSKEL): viser de 4
 * første (nærmeste frist/nyest, allerede sortert av kalleren), med en
 * dempet, stiplet «Vis X til»-knapp som avslører resten på klient
 * (ny saksliste-mockup). Nyavslørte kort toner inn stagget med samme
 * INNTREDEN/STIGRING-tokens som resten av appens lister — allerede synlige
 * kort er urørt (animerer aldri på nytt ved utvidelse).
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
        {synlige.map((sak, i) => {
          const nyAvslørt = visAlle && i >= SYNLIG_UTEN_UTVIDELSE;
          return (
            <m.li
              key={sak.id}
              initial={nyAvslørt ? INNTREDEN.initial : false}
              animate={nyAvslørt ? INNTREDEN.animate : undefined}
              transition={{
                duration: VARIGHET.normal,
                ease: EASING,
                delay: nyAvslørt ? (i - SYNLIG_UTEN_UTVIDELSE) * STIGRING : 0,
              }}
            >
              <Kravkort {...sak} />
            </m.li>
          );
        })}
      </ul>
      {!visAlle && skjulteAntall > 0 && (
        <button
          type="button"
          onClick={() => setVisAlle(true)}
          className="trykk mt-2.5 w-full rounded-[14px] border border-dashed border-strek py-3 text-center text-[13px] font-semibold text-dempet transition hover:text-blekk"
        >
          Vis {skjulteAntall} til
        </button>
      )}
    </>
  );
}
