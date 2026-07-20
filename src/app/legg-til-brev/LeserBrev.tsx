"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { VARIGHET, EASING } from "@/lib/bevegelse";

// Ærlige steg som speiler det appen faktisk gjør mens den leser brevet. Ikke
// en ekte fremdriftsmåler (AI-kallet er ett svar) — men rolig og meningsfull
// ventetid som også viser frem gebyrsjekken.
const STEG = [
  "Leser teksten i brevet …",
  "Finner beløp, datoer og frister …",
  "Kjenner igjen brevtype og avsender …",
  "Sjekker gebyrene mot maksimalsatsene …",
  "Gjør klar forklaringen …",
] as const;

export function LeserBrev() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => Math.min(n + 1, STEG.length - 1));
    }, 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <m.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ikon.svg" alt="" width={52} height={52} aria-hidden />
      </m.div>

      <div className="mt-6 flex h-5 items-center justify-center">
        <AnimatePresence mode="wait">
          <m.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: VARIGHET.normal, ease: EASING }}
            className="text-sm text-dempet"
          >
            {STEG[i]}
          </m.p>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center gap-1.5" aria-hidden>
        {STEG.map((_, n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              n < i
                ? "w-5 bg-aksent"
                : n === i
                  ? "w-5 animate-pulse bg-aksent"
                  : "w-1.5 bg-strek"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
