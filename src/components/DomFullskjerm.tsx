"use client";

// DomFullskjerm — fullskjerm-avsløring av gebyrfunnet, åpnet fra DomMini
// (MEDHOLD_KOMPLETT_ARBEIDSORDRE Del C). Ren presentasjon av et allerede
// lagret GebyrsjekkResultat — ingen ny vurderingslogikk. Bakgrunnen er
// ALLTID #16324f (den opprinnelige mørke aksent-dyp-verdien, FØR palett-
// migreringen i Del 1) — en bevisst, fast farge uavhengig av appens tema
// eller palett (guardrail 3), i likhet med gull (#d9b25e), som også er fast.
import { useEffect, useRef } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { kr, overLinjer, totalOver, funnOrd } from "@/lib/gebyrfunn-visning";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { formaterDato } from "@/lib/dato";
import { SEGL_FJAER } from "@/lib/bevegelse";

const KNAPP_KLASSE =
  "trykk rounded-[10px] border border-white/30 bg-transparent px-5 py-3 text-[14px] font-semibold text-white";

export function DomFullskjerm({
  resultat,
  utkastHref,
  onLukk,
}: {
  resultat: GebyrsjekkResultat;
  /** CTA-en vises kun når stadiet faktisk støtter et utkast (samme sjekk som Veivalg). */
  utkastHref?: string;
  onLukk: () => void;
}) {
  const redusert = useReducedMotion();
  const lukkKnappRef = useRef<HTMLButtonElement>(null);

  // Fokus til overlayet ved åpning (C.3); Esc lukker.
  useEffect(() => {
    lukkKnappRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onLukk();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onLukk]);

  const linjer = overLinjer(resultat);
  const total = totalOver(linjer);

  // Kaskaderende forsinkelser eksakt fra mockupen (C.1) — bevisst tregere/
  // mer dramatisk enn appens vanlige ORKESTER_STIGRING, ikke gjenoppfunnet
  // derfra. Reduced motion: alt synlig samtidig, ingen kaskade.
  const delay = redusert
    ? { tekst: 0, belop: 0, forklaring: 0, knapp: 0 }
    : { tekst: 0.35, belop: 0.5, forklaring: 0.65, knapp: 0.8 };

  return (
    <AnimatePresence>
      <m.div
        role="dialog"
        aria-modal="true"
        aria-label="Gebyrfunn"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center"
        style={{ background: "#16324f" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onLukk();
        }}
      >
        <m.div
          initial={
            redusert
              ? { opacity: 0 }
              : { scale: 0, rotate: -25, opacity: 0 }
          }
          animate={
            redusert
              ? { opacity: 1 }
              : { scale: 1, rotate: -8, opacity: 1 }
          }
          transition={redusert ? { duration: 0.3 } : SEGL_FJAER}
          className="flex size-[120px] items-center justify-center rounded-full font-serif text-[44px] font-semibold"
          style={{ border: "3px solid #d9b25e", color: "#d9b25e" }}
        >
          §
        </m.div>

        <m.p
          className="mt-6 font-serif text-[15px] font-semibold uppercase tracking-[0.02em]"
          style={{ color: "#d9b25e" }}
          initial={{ opacity: redusert ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay.tekst }}
        >
          Funnet av gebyrsjekken
        </m.p>

        <m.p
          className="mt-2 font-serif text-[46px] font-semibold text-white"
          initial={{ opacity: redusert ? 1 : 0, y: redusert ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: delay.belop }}
        >
          {kr(total)} kr
        </m.p>

        <m.p
          className="mt-2.5 max-w-[320px] text-[13px] leading-relaxed text-white/70"
          initial={{ opacity: redusert ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay.forklaring }}
        >
          Gebyrsjekken fant {funnOrd(linjer)} over lovlig sats. Kontrollert mot
          offentlige maksimalsatser, gjeldende fra{" "}
          {formaterDato(resultat.satsGyldigFra)}.
        </m.p>

        <m.div
          className="mt-8 flex gap-3"
          initial={{ opacity: redusert ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay.knapp }}
        >
          {utkastHref && (
            <a href={utkastHref} className={KNAPP_KLASSE}>
              Bruk i svaret →
            </a>
          )}
          <button
            type="button"
            ref={lukkKnappRef}
            onClick={onLukk}
            className={KNAPP_KLASSE}
          >
            Lukk
          </button>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
