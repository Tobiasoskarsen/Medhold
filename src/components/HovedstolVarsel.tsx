"use client";

// Hovedstol-konsistens-varsel (MEDHOLD_HOVEDSTOL_KONSISTENS_ARBEIDSORDRE
// §3.1) — IKKE et gebyrfunn (ikke Dom/DomMini, se guardrail 4), men en egen,
// alltid synlig varselkategori: hovedstolen har endret seg mellom to brev i
// samme sak. Ren observasjon, ingen dom om årsak. «Se detaljer»-utvidelsen
// gjenbruker Utregning/Veivalg sin høyde/opasitet-mekanikk (samme mønster,
// ikke selve Utvidbar-komponenten — dens ikon+etikett-rad passer ikke en
// enkel tekstlenke under en varsellinje).
import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";
import { formaterKortDato } from "@/lib/dato";
import type { HovedstolAvvik } from "@/lib/hovedstol-konsistens";

function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 2 }).format(n);
}

export function HovedstolVarsel({
  avvik,
  className = "",
}: {
  avvik: HovedstolAvvik[];
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  if (avvik.length === 0) return null;

  // Nyeste (mest relevante) avvik — finnHovedstolAvvik() returnerer
  // kronologisk, så det er alltid sist i listen.
  const nyeste = avvik[avvik.length - 1];

  return (
    <div className={`flex items-start gap-3 p-4 ${className}`}>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-liten bg-dom-rod-bg text-dom-rod"
      >
        <TriangleAlert className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
      <p className="radtekst font-medium">Hovedstol</p>
      <p className="mt-0.5 text-[17px] font-bold leading-tight tracking-[-0.01em] text-dom-rod">
        Har endret seg
      </p>
      <p className="mt-1 text-hjelp leading-[1.4] text-blekk">
        Fra {kr(nyeste.forrigeHovedstol)} kr til {kr(nyeste.hovedstol)} kr mellom
        to brev i denne saken — verdt å sjekke.
      </p>

      <button
        type="button"
        onClick={() => setÅpen((o) => !o)}
        aria-expanded={åpen}
        className="trykk -my-2 flex min-h-11 items-center gap-1 text-hjelp font-medium text-dempet transition hover:text-blekk"
      >
        Se detaljer
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${
            åpen ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {åpen && (
          <m.div
            key="detaljer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: VARIGHET.rolig, ease: EASING }}
            style={{ overflow: "hidden" }}
          >
            <ul className="mt-2 flex flex-col gap-1.5 rounded-liten bg-flate-2 p-3">
              {avvik.map((a, i) => (
                <li key={i} className="text-[12.5px] text-dempet">
                  {a.brevdato ? formaterKortDato(a.brevdato) : "Udatert brev"}
                  : {kr(a.forrigeHovedstol)} kr → {kr(a.hovedstol)} kr
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
