"use client";

import type { CSSProperties } from "react";
import { m } from "motion/react";
import { APP_NAME } from "@/lib/brand";
import { EASING, FJAER, ORKESTER_STIGRING, VARIGHET } from "@/lib/bevegelse";

/**
 * Steg 1 — brevkort med rød varsellinje + lupe (SVG/CSS, ingen bilder).
 * Tekst ordrett fra mockup (medhold_ny_onboarding_mockup.html).
 *
 * Første maling (Motion3 §4.1/§4.2, app-start — steg 1 er alltid det
 * første som vises, aktiv fra mount): illustrasjonsflaten skalerer inn
 * (FJAER), brevkortet glir opp, lupen ankommer deretter, og varsellinjen
 * toner inn til slutt. H1/tekst kjeder seg videre med ORKESTER_STIGRING.
 * Kjøres kun én gang — komponentene mountes bare denne ene gangen.
 */
export function BrevSteg({
  illustrasjonStil,
  tekstStil,
}: {
  aktiv?: boolean;
  illustrasjonStil: CSSProperties;
  tekstStil: CSSProperties;
}) {
  return (
    <>
      <div style={illustrasjonStil}>
        <m.div
          className="relative flex size-[180px] items-center justify-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={FJAER}
        >
          <m.div
            className="flex h-[150px] w-[118px] flex-col gap-2 rounded-2xl border-[1.5px] border-strek bg-flate p-4 shadow-[0_10px_24px_rgba(28,43,51,0.10)]"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
          >
            <span className="h-[7px] w-[80%] rounded-full bg-strek" />
            <span className="h-[7px] w-[55%] rounded-full bg-strek" />
            <m.span
              className="h-[7px] w-[70%] rounded-full bg-dom-rod"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{
                duration: VARIGHET.hurtig,
                delay: 2 * ORKESTER_STIGRING,
              }}
            />
            <span className="h-[7px] w-[60%] rounded-full bg-strek" />
          </m.div>
          <m.div
            className="absolute bottom-2 right-0.5 size-[54px] rounded-full border-[5px] border-aksent bg-aksent/[0.06]"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...FJAER, delay: ORKESTER_STIGRING }}
          >
            <span className="absolute -bottom-[11px] -right-[2px] h-[5px] w-5 rotate-45 rounded-[3px] bg-aksent" />
          </m.div>
        </m.div>
      </div>

      <div style={tekstStil}>
        <m.h1
          className="mt-[26px] font-serif text-[25px] font-medium leading-[1.25] tracking-[-0.01em] text-blekk"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: VARIGHET.normal, ease: EASING, delay: ORKESTER_STIGRING }}
        >
          Fått et brev
          <br />
          du gruer deg for?
        </m.h1>
        <m.p
          className="mt-2.5 max-w-[270px] text-sm leading-[1.6] text-dempet"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: VARIGHET.normal,
            ease: EASING,
            delay: 2 * ORKESTER_STIGRING,
          }}
        >
          Fotografer det, lim inn teksten, eller last opp en fil. {APP_NAME}{" "}
          leser det for deg — på under et minutt.
        </m.p>
      </div>
    </>
  );
}
