"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, m } from "motion/react";
import { FJAER, VARIGHET, EASING } from "@/lib/bevegelse";

// Drag krever Motions fulle funksjonssett — lastes først når et ark åpnes.
const lastMaks = () => import("@/lib/motion-max").then((r) => r.default);

// Dratt så langt ned (px), eller så fort (px/s), lukker arket.
const LUKK_AVSTAND = 90;
const LUKK_FART = 500;

/**
 * Bunnark — et ark som glir opp fra bunnen, med håndtak og «dra ned for å
 * lukke». Lukkes også med Esc, trykk på bakgrunnen, eller fra innholdet
 * (`lukk`). Fokus flyttes inn i arket og tilbake til utløseren ved lukking.
 * Rendres i en portal (fixed må ikke arve transform fra foreldre). Ved
 * redusert bevegelse blir glid og drag ren fade (MotionConfig).
 */
export function Bunnark({
  apen,
  onLukk,
  tittel,
  children,
}: {
  apen: boolean;
  onLukk: () => void;
  /** Lesbar tittel for skjermlesere (vises også øverst i arket). */
  tittel: string;
  children: ReactNode;
}) {
  const arkRef = useRef<HTMLDivElement>(null);
  // Siste onLukk i en ref, så effekten under bare kjører ved åpne/lukke —
  // ikke på nytt hver gang forelderen sender en ny inline-funksjon.
  const lukkRef = useRef(onLukk);
  useEffect(() => {
    lukkRef.current = onLukk;
  });
  const [montert, setMontert] = useState(false);

  // Portalen trenger document — kun etter hydrering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontert(true);
  }, []);

  useEffect(() => {
    if (!apen) return;
    const forrige = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tast = (e: KeyboardEvent) => {
      if (e.key === "Escape") lukkRef.current();
    };
    window.addEventListener("keydown", tast);
    // Fokus inn i arket når det er på plass.
    const t = window.setTimeout(() => {
      arkRef.current
        ?.querySelector<HTMLElement>("button, [href], input, [tabindex]")
        ?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", tast);
      window.clearTimeout(t);
      forrige?.focus?.();
    };
  }, [apen]);

  if (!montert) return null;

  return createPortal(
    <LazyMotion features={lastMaks}>
      <AnimatePresence>
        {apen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <m.div
              aria-hidden
              className="absolute inset-0 bg-blekk/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: VARIGHET.rolig, ease: EASING }}
              onClick={onLukk}
            />
            <m.div
              ref={arkRef}
              role="dialog"
              aria-modal="true"
              aria-label={tittel}
              className="relative w-full max-w-[640px] rounded-t-[26px] border-t border-kant bg-flate px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_40px_-16px_rgb(0_0_0/0.35)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={FJAER}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > LUKK_AVSTAND || info.velocity.y > LUKK_FART) onLukk();
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-strek" aria-hidden />
              <p className="mb-2 px-1 text-[13px] font-semibold text-dempet">{tittel}</p>
              {children}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
