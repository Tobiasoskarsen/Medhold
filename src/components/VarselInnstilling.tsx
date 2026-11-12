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
  // R8: iOS-bryter 52×32 med hvit knott som glir (tokenene for bevegelse;
  // redusert bevegelse gir ingen glidning).
  const glid = {
    transitionDuration: "var(--bevegelse-hurtig)",
    transitionTimingFunction: "var(--bevegelse-easing)",
  } as const;
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={aktiv}
        aria-label="Skru e-postpåminnelser av eller på"
        disabled={venter}
        onClick={veksle}
        className={`relative inline-flex h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk focus-visible:ring-offset-2 focus-visible:ring-offset-flate ${
          aktiv ? "bg-knapp" : "bg-strek"
        }`}
        style={glid}
      >
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 size-7 rounded-full bg-white shadow-md transition-transform"
          style={{ ...glid, transform: aktiv ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
      {feil && <span className="text-[11px] text-dom-rod">{feil}</span>}
    </span>
  );
}
