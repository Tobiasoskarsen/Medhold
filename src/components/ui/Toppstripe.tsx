"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Toppstripe — skjermens øverste rad (tilbake, meny) som blir liggende når du
 * scroller. Så lenge siden står øverst er den helt flat; først når innholdet
 * glir under, får den en lett frostet flate og en hårstrek (visuell ordre,
 * fase 2: glass bare der det faktisk ligger noe bak). Scroll-lytteren er
 * passiv og samlet per frame, og bare én klasse byttes — ingen animasjon per
 * scroll-hendelse. Brukes inni Skjermramme (px-5): -mx-5/px-5 gir full bredde.
 */
export function Toppstripe({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [scrollet, setScrollet] = useState(false);

  useEffect(() => {
    let ramme = 0;
    const sjekk = () => {
      cancelAnimationFrame(ramme);
      ramme = requestAnimationFrame(() => setScrollet(window.scrollY > 8));
    };
    sjekk();
    window.addEventListener("scroll", sjekk, { passive: true });
    return () => {
      cancelAnimationFrame(ramme);
      window.removeEventListener("scroll", sjekk);
    };
  }, []);

  return (
    <div
      className={`sticky top-0 z-20 -mx-5 flex items-center justify-between border-b px-5 py-2.5 transition-[background-color,border-color] duration-200 ${
        scrollet
          ? "border-strek bg-bakgrunn/80 backdrop-blur-md backdrop-saturate-150"
          : "border-transparent bg-transparent"
      } ${className}`}
    >
      {children}
    </div>
  );
}
