"use client";

import { useState, useTransition } from "react";
import { settVarsler } from "@/app/(app)/meg/actions";

export default function VarselInnstilling({ pa }: { pa: boolean }) {
  const [aktiv, setAktiv] = useState(pa);
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  function veksle() {
    const ny = !aktiv;
    setAktiv(ny); // optimistisk
    setFeil(null);
    startTransition(async () => {
      const r = await settVarsler(ny);
      if (r?.feil) {
        setAktiv(!ny); // rull tilbake ved feil
        setFeil(r.feil);
      }
    });
  }

  // Kompakt: kun selve bryteren (etiketten bor nå i raden på Meg). Funksjonelt
  // uendret — samme settVarsler, optimistisk oppdatering og rulle-tilbake.
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={aktiv}
        aria-label="Skru e-postpåminnelser av eller på"
        disabled={venter}
        onClick={veksle}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 ${
          aktiv ? "bg-aksent" : "bg-strek"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
            aktiv ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      {feil && <span className="text-[11px] text-red-700">{feil}</span>}
    </span>
  );
}
