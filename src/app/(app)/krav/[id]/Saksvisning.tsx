"use client";

import { useId, useState, type ReactNode } from "react";

/** Kun visning. Panelene beholdes montert, så åpne detaljer og valg ikke mistes. */
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
      <nav aria-label="Visning av saken" className="sticky top-[65px] z-10 -mx-1 mb-5 border-b border-strek bg-bakgrunn px-1">
        <div className="grid grid-cols-3 gap-1">
          {sider.map((side, i) => <button key={side.navn} type="button"
            aria-pressed={valgt === i} aria-controls={`${id}-${i}`} onClick={() => setValgt(i)}
            className={`relative min-h-12 min-w-0 rounded-t-liten px-1 pb-3 pt-2 text-hjelp font-semibold focus-visible:outline-2 focus-visible:outline-aksent ${valgt === i ? "text-blekk" : "text-dempet"}`}>
            {side.navn}{i === 1 && antallDokumenter > 0 && <span className="ml-1 text-meta text-dempet">{antallDokumenter}</span>}
            {valgt === i && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-aksent" />}
          </button>)}
        </div>
      </nav>
      {sider.map((side, i) => <section key={side.navn} id={`${id}-${i}`} hidden={valgt !== i} aria-label={side.navn}>
        {side.innhold}
      </section>)}
    </div>
  );
}
