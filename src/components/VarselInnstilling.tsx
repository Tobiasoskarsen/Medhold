"use client";

import { useState, useTransition } from "react";
import { settVarsler } from "@/app/konto/actions";

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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            E-postpåminnelser
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Få en rolig e-post når en frist nærmer seg — 7 dager før, 3 dager
            før og dagen før. Du kan skru dette av når som helst.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={aktiv}
          aria-label="Skru e-postpåminnelser av eller på"
          disabled={venter}
          onClick={veksle}
          className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-50 ${
            aktiv ? "bg-teal-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
              aktiv ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {feil && <p className="mt-3 text-sm text-red-700">{feil}</p>}
    </div>
  );
}
