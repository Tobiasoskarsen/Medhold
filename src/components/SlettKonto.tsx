"use client";

import { useState, useTransition } from "react";
import { HoldKnapp } from "@/components/ui/HoldKnapp";
import { slettKontoOgData } from "@/app/(app)/meg/actions";

/**
 * Slett kontoen min — dempet rød, nederst på Meg. Først en forklaring, så må
 * man HOLDE knappen inne i to sekunder (HoldKnapp): handlingen er endelig, og
 * et uhell-trykk skal ikke kunne utløse den.
 */
export default function SlettKonto() {
  const [bekreft, setBekreft] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  // Ny nøkkel nullstiller knappen etter en feil (den blir ellers stående i
  // «Sletter …»).
  const [forsok, setForsok] = useState(0);
  const [venter, startTransition] = useTransition();

  if (!bekreft) {
    return (
      <button
        type="button"
        onClick={() => setBekreft(true)}
        className="text-hjelp text-dom-rod/80 transition hover:text-dom-rod"
      >
        Slett kontoen min
      </button>
    );
  }

  return (
    <div className="w-full max-w-[360px] text-center">
      <p className="text-hjelp leading-relaxed text-dempet">
        Dette sletter alle krav, brev, frister og selve kontoen.{" "}
        <strong className="text-blekk">Kan ikke angres.</strong>
      </p>
      {feil && (
        <p role="alert" className="mt-2 text-hjelp text-dom-rod">
          {feil}
        </p>
      )}
      <div className="mt-3">
        <HoldKnapp
          key={forsok}
          holdTime={2000}
          doneLabel="Sletter …"
          onHold={() =>
            startTransition(async () => {
              setFeil(null);
              const r = await slettKontoOgData();
              if (r?.feil) {
                setFeil(r.feil);
                setForsok((n) => n + 1);
              }
            })
          }
        >
          Hold for å slette alt
        </HoldKnapp>
      </div>
      <button
        type="button"
        onClick={() => setBekreft(false)}
        disabled={venter}
        className="mt-1 text-hjelp text-dempet transition hover:text-blekk disabled:opacity-50"
      >
        Avbryt
      </button>
    </div>
  );
}
