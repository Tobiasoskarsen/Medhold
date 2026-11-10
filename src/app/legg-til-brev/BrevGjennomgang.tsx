"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { Primærknapp } from "@/components/ui";
import { EASING, FJAER, GLID_DYBDE, VARIGHET } from "@/lib/bevegelse";

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
  const reduserBevegelse = useReducedMotion();
  const [retning, setRetning] = useState(1);
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
    if (neste === side) return;
    setRetning(neste > side ? 1 : -1);
    setValgt(neste);
    requestAnimationFrame(() => {
      overskrift.current?.focus({ preventScroll: true });
      overskrift.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  return (
    <>
      <nav aria-label="Gjennomgang av brevet" className="sticky top-0 z-10 -mx-5 border-b border-strek bg-bakgrunn px-5 pt-2 pb-3">
        <ol className="grid grid-cols-3 gap-2">
          {DELER.map((del, i) => (
            <li key={del.navn}>
              <button type="button" onClick={() => bytt(i)} disabled={lagrer || (i > 0 && (!bekreftet || i > valgt))}
                aria-current={side === i ? "step" : undefined}
                className={`flex min-h-[60px] w-full flex-col items-center justify-center gap-1 min-[380px]:min-h-11 min-[380px]:flex-row min-[380px]:gap-1.5 rounded-kontroll px-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-aksent disabled:cursor-not-allowed ${side === i ? "text-aksent" : "text-dempet"}`}>
                <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] transition-colors ${i === side ? "bg-aksent text-aksent-tekst" : i < side ? "bg-aksent/10 text-aksent" : "bg-flate-2 text-dempet"}`}>
                  {i < side ? <Check className="size-3.5" /> : i + 1}
                </span>
                {del.navn}
              </button>
            </li>
          ))}
        </ol>
        <div aria-hidden className="mt-2 h-0.5 overflow-hidden rounded-full bg-strek">
          <m.div className="h-full origin-left rounded-full bg-aksent" initial={false}
            animate={{ scaleX: (side + 1) / DELER.length }}
            transition={reduserBevegelse ? { duration: 0 } : FJAER} />
        </div>
      </nav>
      <section aria-labelledby={id} className="flex flex-1 flex-col">
        <header className="mb-5 mt-6">
          <p className="mb-2 text-meta font-medium text-dempet">Gjennomgå brevet · {side + 1} av 3</p>
          <h1 id={id} ref={overskrift} tabIndex={-1} className="tittel-s scroll-mt-24 text-blekk focus:outline-none">{DELER[side].tittel}</h1>
          <p className="mt-2 text-hjelp text-dempet">{DELER[side].tekst}</p>
        </header>
        <m.div key={side} initial={reduserBevegelse ? false : { opacity: 0, x: retning * GLID_DYBDE }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduserBevegelse ? 0 : VARIGHET.normal, ease: EASING }}>
          {side === 0 ? opplysninger : side === 1 ? kontroll : handling}
        </m.div>
        {feil && <p role="alert" className="mt-4 text-hjelp text-dom-rod">{feil}</p>}
        <footer className="sticky bottom-0 z-10 -mx-5 mt-6 border-t border-strek bg-bakgrunn px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            {side > 0 && <button type="button" disabled={lagrer} onClick={() => bytt(side - 1)} className="flex min-h-11 items-center gap-1 rounded-kontroll px-3 text-hjelp font-semibold text-blekk focus-visible:outline-2 focus-visible:outline-aksent disabled:opacity-50"><ChevronLeft className="size-4" aria-hidden />Tilbake</button>}
            {side < 2 ? <Primærknapp type="button" disabled={!bekreftet || lagrer} onClick={() => bytt(side + 1)}>{side === 0 ? "Se kontrollen" : "Velg neste steg"}</Primærknapp> : <p className="text-meta text-dempet">{lagrer ? "Lagrer brevet …" : "Du sender eventuelle svarbrev selv."}</p>}
          </div>
          {side === 0 && !bekreftet && <p className="mt-2 text-meta text-dempet">Bekreft opplysningene over for å fortsette.</p>}
        </footer>
      </section>
    </>
  );
}
