"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

/**
 * Delte elementoverganger på tvers av RUTER (Motion2 §1) — framer sin
 * `layoutId` virker ikke over Next sine rutegrenser (gammel side avmonteres før
 * ny monteres), så vi bruker browserens native View Transitions API i stedet.
 *
 * Providermønsteret: `start(navigate)` kjører navigasjonen inne i
 * `document.startViewTransition`, og holder overgangen «pending» til den nye
 * ruten faktisk er montert (usePathname endrer seg) — da tas ny-snapshot og
 * morfen spilles. Elementer med samme `view-transition-name` glir; roten
 * kryssfader. Provideren bor i (app)-layout som IKKE remountes ved navigasjon,
 * så `finishRef` overlever overgangen.
 */
type Ctx = { start: (navigate: () => void) => void };
const ViewOvergangCtx = createContext<Ctx>({ start: (n) => n() });

type MedVT = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => unknown;
};

export function ViewOvergangProvider({ children }: { children: ReactNode }) {
  const finishRef = useRef<(() => void) | null>(null);
  const pathname = usePathname();

  // Ny rute montert → fullfør en ventende overgang (tar ny-snapshot).
  useEffect(() => {
    finishRef.current?.();
    finishRef.current = null;
  }, [pathname]);

  const start = (navigate: () => void) => {
    const doc = document as MedVT;
    const reduser =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!doc.startViewTransition || reduser) {
      navigate();
      return;
    }
    doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          let ferdig = false;
          const fullfor = () => {
            if (ferdig) return;
            ferdig = true;
            resolve();
          };
          // Sikkerhetsnett: fullfør uansett hvis rute-effekten ikke fyrer
          // (avbrutt navigasjon, samme rute e.l.) — så siden aldri fryser.
          const t = window.setTimeout(fullfor, 600);
          finishRef.current = () => {
            window.clearTimeout(t);
            fullfor();
          };
          navigate();
        }),
    );
  };

  return (
    <ViewOvergangCtx.Provider value={{ start }}>
      {children}
    </ViewOvergangCtx.Provider>
  );
}

export function useViewOvergang() {
  return useContext(ViewOvergangCtx);
}
