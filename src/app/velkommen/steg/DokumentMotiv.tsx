"use client";

import { m, useReducedMotion } from "motion/react";
import { Pencil } from "lucide-react";
import { EASING, SKANN_SYKLUS, VARIGHET } from "@/lib/bevegelse";
import { useForstegangsvisning } from "./useForstegangsvisning";

const LINJER = [82, 58, 74, 66, 48];

/**
 * Introduksjonens ene motiv: samme brev gjennom tre faser. 0 = brevet leses
 * (skannelinje, samme uttrykk som i appen), 1 = gebyr og dato markeres, 2 =
 * brevet blir et redigerbart utkast. Fast størrelse, så teksten under starter
 * på samme sted i alle stegene. Kun transform og opasitet animeres.
 */
export function DokumentMotiv({ fase, aktiv }: { fase: 0 | 1 | 2; aktiv: boolean }) {
  const vist = useForstegangsvisning(aktiv);
  const redusert = useReducedMotion();
  const inn = (forsinkelse: number) => ({
    initial: { opacity: 0, y: 4 },
    animate: vist ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 },
    transition: { duration: VARIGHET.normal, ease: EASING, delay: forsinkelse },
  });

  return (
    <div
      aria-hidden
      className="relative flex h-[232px] w-[176px] flex-col gap-2.5 overflow-hidden rounded-kort border border-strek bg-flate p-4 text-left"
      style={{ boxShadow: "var(--skygge-hevet)" }}
    >
      {fase === 2 ? (
        <>
          <span className="text-meta font-semibold text-blekk">Hei,</span>
          {LINJER.slice(0, 3).map((b, i) => (
            <span key={i} className="h-1.5 rounded-full bg-blekk/25" style={{ width: `${b}%` }} />
          ))}
          <span className="mt-1 h-1.5 w-[70%] rounded-full bg-blekk/25" />
          <span className="flex items-center gap-0.5">
            <span className="h-1.5 w-[44%] rounded-full bg-blekk/25" />
            <span className="h-3 w-px bg-aksent" />
          </span>
          <span className="mt-auto text-meta text-dempet">Vennlig hilsen</span>
          <m.span
            {...inn(0.1)}
            className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-mint text-mint-tekst"
          >
            <Pencil className="size-4" />
          </m.span>
        </>
      ) : (
        <>
          <span className="h-2 w-1/2 rounded-full bg-strek" />
          {LINJER.slice(0, 2).map((b, i) => (
            <span key={i} className="h-1.5 rounded-full bg-strek" style={{ width: `${b}%` }} />
          ))}
          {fase === 1 ? (
            <m.span
              {...inn(0.05)}
              className="-mx-1 flex items-center justify-between rounded-[6px] bg-dom-rod-bg px-1.5 py-1 text-meta font-semibold text-dom-rod"
            >
              Gebyr
              <span className="h-1.5 w-8 rounded-full bg-dom-rod/40" />
            </m.span>
          ) : (
            <span className="h-1.5 w-[74%] rounded-full bg-strek" />
          )}
          <span className="h-1.5 w-[66%] rounded-full bg-strek" />
          {fase === 1 ? (
            <m.span
              {...inn(0.15)}
              className="-mx-1 flex items-center justify-between rounded-[6px] bg-mint px-1.5 py-1 text-meta font-semibold text-mint-tekst"
            >
              Dato
              <span className="h-1.5 w-8 rounded-full bg-mint-tekst/30" />
            </m.span>
          ) : (
            <span className="h-1.5 w-[48%] rounded-full bg-strek" />
          )}
          <span className="h-1.5 w-[60%] rounded-full bg-strek" />
          {fase === 0 && !redusert && (
            <m.span
              className="pointer-events-none absolute inset-x-0 top-0 h-full"
              initial={{ y: "-100%" }}
              animate={aktiv ? { y: "0%" } : { y: "-100%" }}
              transition={{
                duration: SKANN_SYKLUS,
                ease: "easeInOut",
                repeat: aktiv ? Infinity : 0,
                repeatType: "mirror",
              }}
            >
              <span className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-b from-transparent to-aksent-lys/15" />
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-aksent-lys" />
            </m.span>
          )}
        </>
      )}
    </div>
  );
}
