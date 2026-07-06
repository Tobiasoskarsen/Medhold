"use client";

import { useState, useTransition } from "react";
import { slettKontoOgData } from "@/app/(app)/meg/actions";

/**
 * Slett kontoen min — dempet rød, nederst på Meg. Krever ett bekreftelsessteg
 * (handlingen er endelig).
 */
export default function SlettKonto() {
  const [bekreft, setBekreft] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  if (!bekreft) {
    return (
      <button
        type="button"
        onClick={() => setBekreft(true)}
        className="text-[13px] text-red-700/80 transition hover:text-red-700"
      >
        Slett kontoen min
      </button>
    );
  }

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-dempet">
        Dette sletter alle krav, brev, frister og selve kontoen.{" "}
        <strong className="text-blekk">Kan ikke angres.</strong>
      </p>
      {feil && <p className="mt-2 text-[13px] text-red-700">{feil}</p>}
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          disabled={venter}
          onClick={() =>
            startTransition(async () => {
              setFeil(null);
              const r = await slettKontoOgData();
              if (r?.feil) setFeil(r.feil);
            })
          }
          className="rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {venter ? "Sletter …" : "Ja, slett alt"}
        </button>
        <button
          type="button"
          onClick={() => setBekreft(false)}
          className="text-[13px] text-dempet transition hover:text-blekk"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
}
