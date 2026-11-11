"use client";

import { useState } from "react";
import Image from "next/image";
import type { Bilde } from "@/lib/brevanalyse";

/** Kun lokalt opplastet innhold. Ingenting lastes opp eller lagres her. */
export function BrevReferanse({ filer, tekst }: { filer: (Bilde & { navn: string })[]; tekst: string }) {
  if (!filer.length && !tekst) return null;
  return (
    <details className="mb-4 rounded-kort border border-strek bg-flate p-4">
      <summary className="min-h-11 cursor-pointer rounded-liten text-hjelp font-semibold text-aksent focus-visible:outline-2 focus-visible:outline-aksent">Se originalbrevet</summary>
      <div className="mt-3 max-h-[60dvh] space-y-4 overflow-auto overscroll-contain rounded-liten" tabIndex={0} aria-label="Originalbrev">
        {filer.map((fil, i) => fil.media_type === "application/pdf" ? (
          <div key={i} className="text-hjelp text-dempet">
            <p>Åpne den opplastede PDF-en ved siden av Medhold for å sammenligne opplysningene.</p>
            <a href={`data:application/pdf;base64,${fil.data}`} download={fil.navn} className="mt-2 inline-flex min-h-11 items-center font-semibold text-aksent underline">Last ned original-PDF</a>
          </div>
        ) : (
          <BrevBilde key={i} fil={fil} side={i + 1} />
        ))}
        {!filer.length && <p className="whitespace-pre-wrap break-words text-hjelp leading-relaxed text-blekk">{tekst}</p>}
      </div>
    </details>
  );
}

function BrevBilde({ fil, side }: { fil: Bilde; side: number }) {
  const [feil, setFeil] = useState(false);
  return feil ? <p role="status" className="p-3 text-hjelp text-dempet">Kunne ikke vise side {side}. Opplysningene du har rettet er beholdt. Sammenlign med filen på enheten din.</p> : <Image src={`data:${fil.media_type};base64,${fil.data}`} alt={`Opplastet brev, side ${side}`} width={1568} height={2080} unoptimized className="h-auto w-full rounded-liten" onError={() => setFeil(true)} />;
}
