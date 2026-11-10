import type { ReactNode } from "react";
import { formaterKortDato } from "@/lib/dato";
import type { FristSammenligning } from "@/lib/frist";
import type { FristForslag } from "@/lib/types";

export function SakOgFrister({ sakNavn, frister, fristfunn, alvorlig, harMatch, kreverBekreftelse, children }: {
  sakNavn: string; frister: FristForslag[]; fristfunn: FristSammenligning | null;
  alvorlig: boolean; harMatch: boolean; kreverBekreftelse: boolean; children: ReactNode;
}) {
  const datoer = frister.flatMap(f => f.forfallsdato ? [f.forfallsdato] : []).sort();
  const kort = fristfunn?.status === "avvik_kortere";
  return (
    <section aria-label="Sak og registrering">
      {kort && <p role="note" className="mb-3 rounded-kontroll bg-dom-rod-bg p-3 text-hjelp text-blekk">
        <strong className="text-dom-rod">Fristen i brevet kan være for kort.</strong>{" "}
        Brevet oppgir {formaterKortDato(fristfunn.eksplisittDato as string)}. Kontroller fristvalget nedenfor. Advarselen gjelder også om du ikke registrerer fristen.
      </p>}
      {alvorlig && <p role="alert" className="mb-3 rounded-kontroll bg-dom-rod-bg p-3 text-hjelp text-blekk">Brevet er markert med et alvorlig varsel. Lagre brevet i saken for å finne varselet og hjelpetilbudene.</p>}
      <details className="rounded-kort border border-strek bg-flate p-4" open={harMatch || kort}>
        <summary className="min-h-11 cursor-pointer rounded-liten text-hjelp font-semibold text-blekk focus-visible:outline-2 focus-visible:outline-aksent">
          Sak, frister og huskeliste
          <span className="mt-1 block text-meta font-normal text-dempet">{sakNavn} · {datoer.length ? `${datoer.length} ${datoer.length === 1 ? "valgt frist" : "valgte frister"}` : "Ingen frister valgt for lagring"}</span>
          {datoer[0] && <span className="mt-1 block text-meta font-normal text-dempet">Neste valgte frist: {formaterKortDato(datoer[0])}</span>}
          {kreverBekreftelse && <span className="mt-1 block text-meta font-semibold text-blekk">Se særskilte valg og bekreftelser nedenfor.</span>}
        </summary>
        <p className="mt-2 text-meta text-dempet">Bare valgte frister og steg registreres når brevet lagres.</p>
        {children}
      </details>
    </section>
  );
}
