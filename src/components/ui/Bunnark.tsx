"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LazyMotion, m, useDragControls } from "motion/react";
import { FJAER, VARIGHET, EASING } from "@/lib/bevegelse";

// Drag krever Motions fulle funksjonssett — lastes først når et ark åpnes.
const lastMaks = () => import("@/lib/motion-max").then((r) => r.default);

// Dratt så langt ned (px), eller så fort (px/s), lukker arket.
const LUKK_AVSTAND = 90;
const LUKK_FART = 500;

/**
 * Bunnark — et ark som glir opp fra bunnen, med håndtak og «dra ned for å
 * lukke». Lukkes også med Esc eller trykk på bakgrunnen. Fokus flyttes inn i
 * arket, holdes der (Tab går i ring), og går tilbake til utløseren ved lukking;
 * resten av siden er utilgjengelig (inert) mens arket er åpent.
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
  const dra = useDragControls();
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
      if (e.key === "Escape") {
        lukkRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const ark = arkRef.current;
      if (!ark) return;
      const fokuserbare = ark.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (fokuserbare.length === 0) return;
      const forste = fokuserbare[0];
      const siste = fokuserbare[fokuserbare.length - 1];
      const aktiv = document.activeElement;
      if (e.shiftKey && (aktiv === forste || !ark.contains(aktiv))) {
        e.preventDefault();
        siste.focus();
      } else if (!e.shiftKey && (aktiv === siste || !ark.contains(aktiv))) {
        e.preventDefault();
        forste.focus();
      }
    };
    // Bakgrunnen utilgjengelig: alt i body utenom portalen med arket.
    const bak: Element[] = [];
    const settInert = () => {
      const ark = arkRef.current;
      if (!ark) return;
      for (const el of Array.from(document.body.children)) {
        if (!el.contains(ark) && !el.hasAttribute("inert")) {
          el.setAttribute("inert", "");
          bak.push(el);
        }
      }
    };
    window.addEventListener("keydown", tast);
    // Fokus inn i arket når det er på plass.
    const t = window.setTimeout(() => {
      settInert();
      arkRef.current
        ?.querySelector<HTMLElement>("button, [href], input, [tabindex]")
        ?.focus();
    }, 50);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", tast);
      window.clearTimeout(t);
      bak.forEach((el) => el.removeAttribute("inert"));
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
              className="relative max-h-[85dvh] w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-t-helt border-t border-kant bg-flate px-[18px] pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5"
              style={{ boxShadow: "var(--skygge-hevet)" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={FJAER}
              drag="y"
              // Drag startes manuelt, så felt og hold-knapper (data-ingen-drag)
              // ikke drar arket med seg når fingeren skjelver litt.
              dragListener={false}
              dragControls={dra}
              onPointerDown={(e) => {
                const mål = e.target as HTMLElement;
                if (mål.closest("[data-ingen-drag], input, textarea, select")) return;
                dra.start(e);
              }}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > LUKK_AVSTAND || info.velocity.y > LUKK_FART) onLukk();
              }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-strek" aria-hidden />
              <p className="mb-2 px-1 text-hjelp font-semibold text-dempet">{tittel}</p>
              {children}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
