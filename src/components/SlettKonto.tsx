"use client";

import { useState, useTransition } from "react";
import { slettKontoOgData } from "@/app/konto/actions";

export default function SlettKonto() {
  const [bekreft, setBekreft] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  const kanSlette = bekreft.trim().toUpperCase() === "SLETT";

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
      <h2 className="text-base font-semibold text-red-800">
        Slett all data og konto
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Dette sletter alle sakene, fristene, stegene og forklaringene dine, og
        selve kontoen. Handlingen er <strong>endelig og kan ikke angres</strong>.
      </p>

      <label className="mt-4 block text-sm text-slate-700">
        Skriv <span className="font-mono font-semibold">SLETT</span> for å
        bekrefte:
        <input
          value={bekreft}
          onChange={(e) => setBekreft(e.target.value)}
          className="mt-1 block w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          placeholder="SLETT"
        />
      </label>

      {feil && <p className="mt-3 text-sm text-red-700">{feil}</p>}

      <button
        type="button"
        disabled={!kanSlette || venter}
        onClick={() =>
          startTransition(async () => {
            setFeil(null);
            const r = await slettKontoOgData();
            if (r?.feil) setFeil(r.feil);
          })
        }
        className="mt-4 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {venter ? "Sletter …" : "Slett alt for godt"}
      </button>
    </div>
  );
}
