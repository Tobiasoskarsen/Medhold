"use client";

import { useEffect, useState, useTransition } from "react";
import { lagreBrevnavn } from "./actions";

/** Fullt navn til brevsignaturen — fylles automatisk inn neste gang du lager
 * et utkast, uten at du må skrive det på nytt. Lagres når feltet forlates. */
export function Brevnavn({ start }: { start: string }) {
  const [navn, setNavn] = useState(start);
  const [lagret, setLagret] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  // «Lagret» forsvinner av seg selv, så den ikke blir stående som stale state.
  useEffect(() => {
    if (!lagret) return;
    const t = setTimeout(() => setLagret(false), 2500);
    return () => clearTimeout(t);
  }, [lagret]);

  function lagre() {
    if (navn.trim() === start.trim()) return;
    setFeil(null);
    setLagret(false);
    startTransition(async () => {
      const r = await lagreBrevnavn(navn);
      if (r?.feil) setFeil(r.feil);
      else setLagret(true);
    });
  }

  return (
    <div>
      <label htmlFor="brevnavn" className="text-sm font-medium text-blekk">
        Fullt navn
      </label>
      <p className="mt-0.5 text-[13px] text-dempet">
        Valgfritt — brukes som signatur når vi lager et utkast til brev.
      </p>
      <input
        id="brevnavn"
        type="text"
        value={navn}
        maxLength={80}
        placeholder="Fullt navn"
        onChange={(e) => {
          setNavn(e.target.value);
          setLagret(false);
        }}
        onBlur={lagre}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="mt-2 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-3 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
      />
      {feil ? (
        <p className="mt-1.5 text-[13px] text-red-700">{feil}</p>
      ) : (
        lagret && !venter && (
          <p className="mt-1.5 text-[13px] text-trygg">Lagret</p>
        )
      )}
    </div>
  );
}
