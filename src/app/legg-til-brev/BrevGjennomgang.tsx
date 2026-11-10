"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { Primærknapp } from "@/components/ui";

const DELER = [
  { navn: "Opplysninger", tittel: "Stemmer opplysningene?", tekst: "Sammenlign med brevet. Retter du noe her, regner vi alt på nytt." },
  { navn: "Kontroll", tittel: "Dette har vi kontrollert", tekst: "Se gjennom beløpskontrollen og hva vurderingen omfatter." },
  { navn: "Neste steg", tittel: "Hva vil du gjøre videre?", tekst: "Velg sak, frister og neste steg. Brevet lagres først når du velger en handling nederst." },
];

/** Kun presentasjon. Alle redigerte verdier og lagringsregler eies av brevflyten. */
export function BrevGjennomgang({ bekreftet, opplysninger, kontroll, handling, feil, lagrer }: {
  bekreftet: boolean; opplysninger: ReactNode; kontroll: ReactNode;
  handling: ReactNode; feil: string | null; lagrer: boolean;
}) {
  const [valgt, setValgt] = useState(0);
  const [forrigeBekreftet, setForrigeBekreftet] = useState(bekreftet);
  if (forrigeBekreftet !== bekreftet) {
    setForrigeBekreftet(bekreftet);
    if (!bekreftet) setValgt(0);
  }
  // En serverkontroll kan trekke bekreftelsen tilbake etter et lagringsforsøk.
  const side = bekreftet ? valgt : 0;
  const overskrift = useRef<HTMLHeadingElement>(null);
  const id = useId();
  function bytt(neste: number) {
    if (lagrer || (neste > 0 && !bekreftet)) return;
    setValgt(neste);
    requestAnimationFrame(() => {
      overskrift.current?.focus({ preventScroll: true });
      overskrift.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  return (
    <>
      <nav aria-label="Gjennomgang av brevet" className="sticky top-0 z-10 -mx-5 border-b border-strek bg-bakgrunn px-5 py-3">
        <ol className="grid grid-cols-3 gap-2">
          {DELER.map((del, i) => (
            <li key={del.navn}>
              <button type="button" onClick={() => bytt(i)} disabled={lagrer || (i > 0 && (!bekreftet || i > valgt))}
                aria-current={side === i ? "step" : undefined}
                className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-kontroll px-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-aksent disabled:cursor-not-allowed ${side === i ? "bg-blekk text-bakgrunn" : "text-dempet"}`}>
                {i < side ? <Check className="size-3.5 shrink-0" aria-hidden /> : <span aria-hidden>{i + 1}</span>}
                {del.navn}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <section aria-labelledby={id} className="flex flex-1 flex-col">
        <header className="mb-4 mt-5">
          <p className="mb-2 text-meta text-dempet">Del {side + 1} av 3 · Gjennomgå brevet</p>
          <h1 id={id} ref={overskrift} tabIndex={-1} className="tittel-s scroll-mt-24 text-blekk focus:outline-none">{DELER[side].tittel}</h1>
          <p className="mt-2 text-hjelp text-dempet">{DELER[side].tekst}</p>
        </header>
        {side === 0 ? opplysninger : side === 1 ? kontroll : handling}
        {feil && <p role="alert" className="mt-4 text-hjelp text-dom-rod">{feil}</p>}
        <footer className="sticky bottom-0 z-10 mt-6 border-t border-strek bg-bakgrunn pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            {side > 0 && <button type="button" disabled={lagrer} onClick={() => bytt(side - 1)} className="flex min-h-11 items-center gap-1 rounded-kontroll px-3 text-hjelp font-semibold text-blekk focus-visible:outline-2 focus-visible:outline-aksent disabled:opacity-50"><ChevronLeft className="size-4" aria-hidden />Tilbake</button>}
            {side < 2 ? <Primærknapp type="button" disabled={!bekreftet || lagrer} onClick={() => bytt(side + 1)}>{side === 0 ? "Se kontrollen" : "Velg neste steg"}</Primærknapp> : <p className="text-meta text-dempet">{lagrer ? "Lagrer brevet …" : "Du sender eventuelle svarbrev selv."}</p>}
          </div>
          {side === 0 && !bekreftet && <p className="mt-2 text-meta text-dempet">Bekreft opplysningene for å fortsette. Ved sumavvik må også avviket bekreftes.</p>}
        </footer>
      </section>
    </>
  );
}
