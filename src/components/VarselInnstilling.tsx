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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blekk">E-postpåminnelser</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-dempet">
            Én rolig e-post når en frist nærmer seg — 7, 3 og 1 dag før.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aktiv}
          aria-label="Skru e-postpåminnelser av eller på"
          disabled={venter}
          onClick={veksle}
          className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 ${
            aktiv ? "bg-aksent" : "bg-strek"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
              aktiv ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {feil && <p className="mt-2 text-[13px] text-red-700">{feil}</p>}
    </div>
  );
}
