"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Segmentert kontroll for Oversikt, Dokumenter og Historikk (R8). Kun visning:
 * panelene beholdes montert, så åpne detaljer og valg ikke mistes. Den aktive
 * pillen glir mellom segmentene med CSS (tokenene --bevegelse-hurtig og
 * --bevegelse-easing); redusert bevegelse gir ingen glidning, siden
 * globals.css nuller ut alle overganger.
 */
export function Saksvisning({ oversikt, dokumenter, historikk, antallDokumenter }: {
  oversikt: ReactNode; dokumenter: ReactNode; historikk: ReactNode; antallDokumenter: number;
}) {
  const [valgt, setValgt] = useState(0);
  const id = useId();
  const sider = [
    { navn: "Oversikt", innhold: oversikt },
    { navn: "Dokumenter", innhold: dokumenter },
    { navn: "Historikk", innhold: historikk },
  ];
  return (
    <div className="mt-5">
      <nav aria-label="Visning av saken">
        <div className="relative grid grid-cols-3 rounded-full bg-flate-2 p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-flate shadow-sm"
            style={{
              transform: `translateX(${valgt * 100}%)`,
              transitionProperty: "transform",
              transitionDuration: "var(--bevegelse-hurtig)",
              transitionTimingFunction: "var(--bevegelse-easing)",
            }}
          />
          {sider.map((side, i) => <button key={side.navn} type="button"
            aria-pressed={valgt === i} aria-controls={`${id}-${i}`} onClick={() => setValgt(i)}
            className={`relative min-h-11 min-w-0 rounded-full px-1 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk ${valgt === i ? "text-blekk" : "text-dempet"}`}>
            {side.navn}{i === 1 && antallDokumenter > 0 && <span className="ml-1 text-meta font-medium text-dempet">{antallDokumenter}</span>}
          </button>)}
        </div>
      </nav>
      <div className="mt-4">
        {sider.map((side, i) => <section key={side.navn} id={`${id}-${i}`} hidden={valgt !== i} aria-label={side.navn}>
          {side.innhold}
        </section>)}
      </div>
    </div>
  );
}
