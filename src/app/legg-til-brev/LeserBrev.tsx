"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { VARIGHET, EASING, FJAER, SKANN_SYKLUS } from "@/lib/bevegelse";

// Ærlige steg som speiler det appen faktisk gjør mens den leser brevet. Ikke
// en ekte fremdriftsmåler (AI-kallet er ett svar) — men rolig og meningsfull
// ventetid som også viser frem gebyrsjekken. Hvert steg har en kort etikett
// til sjekklisten under arket.
const STEG = [
  { tekst: "Leser teksten i brevet …", etikett: "Tekst" },
  { tekst: "Finner beløp, datoer og frister …", etikett: "Beløp og datoer" },
  { tekst: "Kjenner igjen brevtype og avsender …", etikett: "Brevtype" },
  { tekst: "Sjekker gebyrene mot maksimalsatsene …", etikett: "Gebyrer" },
  { tekst: "Gjør klar forklaringen …", etikett: "Forklaring" },
] as const;

const STEG_MS = 2600;

/** Hjørnemarkør i skannerens ramme (L-form, mint). */
function Hjorne({ plass }: { plass: string }) {
  return (
    <span
      aria-hidden
      className={`absolute size-4 border-aksent-lys ${plass}`}
    />
  );
}

/**
 * Lesingen av brevet som en skanning (visuell ordre, fase 1): selve brevet —
 * bildet brukeren la til, eller den innlimte teksten — ligger dempet i en
 * ramme med hjørnemarkører, mens en mint skannelinje glir over arket.
 * Sjekklisten under fylles ut i takt med stegene. Bare transform og opasitet
 * animeres. Ved redusert bevegelse står linjen stille og alt annet fader.
 */
export function LeserBrev({
  bilde,
  tekst,
}: {
  /** Data-URL til første bilde. PDF/ingen → stilisert ark. */
  bilde?: string | null;
  /** Innlimt tekst, vist som de første linjene på arket. */
  tekst?: string | null;
}) {
  const [i, setI] = useState(0);
  const redusert = useReducedMotion();

  useEffect(() => {
    const t = setInterval(() => {
      setI((n) => Math.min(n + 1, STEG.length - 1));
    }, STEG_MS);
    return () => clearInterval(t);
  }, []);

  const linjer = (tekst ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 22);

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
      <div
        className="relative w-[220px] p-3"
        role="img"
        aria-label="Medhold leser brevet"
      >
        <Hjorne plass="left-0 top-0 rounded-tl-[6px] border-l-2 border-t-2" />
        <Hjorne plass="right-0 top-0 rounded-tr-[6px] border-r-2 border-t-2" />
        <Hjorne plass="bottom-0 left-0 rounded-bl-[6px] border-b-2 border-l-2" />
        <Hjorne plass="bottom-0 right-0 rounded-br-[6px] border-b-2 border-r-2" />

        <div className="relative aspect-[3/4] overflow-hidden rounded-liten border border-strek bg-flate">
          {bilde ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bilde}
              alt=""
              className="size-full object-cover opacity-60 saturate-50"
            />
          ) : linjer.length > 0 ? (
            <div className="size-full overflow-hidden px-3 py-3 text-left text-[6.5px] leading-[1.55] text-dempet">
              {linjer.map((l, n) => (
                <p key={n} className="truncate">
                  {l}
                </p>
              ))}
            </div>
          ) : (
            // Stilisert ark (PDF uten forhåndsvisning).
            <div className="flex size-full flex-col gap-2 px-4 py-5" aria-hidden>
              <span className="h-2 w-1/2 rounded-full bg-strek" />
              {[92, 80, 86, 64, 0, 88, 76, 90, 58, 0, 70, 84].map((w, n) =>
                w === 0 ? (
                  <span key={n} className="h-1.5" />
                ) : (
                  <span
                    key={n}
                    className="h-1.5 rounded-full bg-strek"
                    style={{ width: `${w}%` }}
                  />
                ),
              )}
            </div>
          )}

          {/* Skannelinjen: et overlegg på full høyde som flyttes fra over
              arket til under det — linjen sitter i overleggets nedkant, og
              et svakt mint slør følger etter den. */}
          {!redusert && (
            <m.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-full"
              initial={{ y: "-100%" }}
              animate={{ y: "0%" }}
              transition={{
                duration: SKANN_SYKLUS,
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "mirror",
              }}
            >
              <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-aksent-lys/15" />
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-aksent-lys shadow-[0_0_12px_2px_var(--aksent-lys)]" />
            </m.div>
          )}
        </div>
      </div>

      <div className="mt-6 flex h-5 items-center justify-center" aria-live="polite">
        <AnimatePresence mode="wait">
          <m.p
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: VARIGHET.normal, ease: EASING }}
            className="text-sm text-dempet"
          >
            {STEG[i].tekst}
          </m.p>
        </AnimatePresence>
      </div>

      {/* Sjekklisten: ferdige steg får hake, det aktive en pulserende prikk. */}
      <ul className="mt-5 flex flex-wrap justify-center gap-1.5" aria-hidden>
        {STEG.map((s, n) => {
          const ferdig = n < i;
          const aktiv = n === i;
          return (
            <li
              key={s.etikett}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-300 ${
                ferdig
                  ? "bg-mint text-mint-tekst"
                  : aktiv
                    ? "bg-flate text-blekk ring-1 ring-strek"
                    : "text-dempet"
              }`}
            >
              <span className="relative flex size-3 items-center justify-center">
                <AnimatePresence initial={false}>
                  {ferdig ? (
                    <m.span
                      key="hake"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={FJAER}
                      className="absolute"
                    >
                      <Check className="size-3" strokeWidth={3} />
                    </m.span>
                  ) : (
                    <m.span
                      key="prikk"
                      // Egen overgang: ellers arver den pulsens «repeat: Infinity»,
                      // blir aldri ferdig og blinker bak haken for alltid.
                      exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
                      className={`absolute size-1.5 rounded-full ${
                        aktiv ? "bg-aksent-lys" : "bg-strek"
                      }`}
                      animate={
                        aktiv && !redusert
                          ? { opacity: [1, 0.35, 1] }
                          : { opacity: 1 }
                      }
                      transition={
                        aktiv && !redusert
                          ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                          : undefined
                      }
                    />
                  )}
                </AnimatePresence>
              </span>
              {s.etikett}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
