"use client";

import { useEffect, useState, useTransition } from "react";
import { lagreTelefon } from "./actions";

/**
 * Valgfritt telefonnummer. Lagres i profilen når feltet forlates. Brukes ikke
 * til innlogging ennå — klargjort for SMS-påminnelser/-innlogging senere.
 */
export function Telefon({ start }: { start: string }) {
  const [nummer, setNummer] = useState(start);
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
    if (nummer.trim() === start.trim()) return;
    setFeil(null);
    setLagret(false);
    startTransition(async () => {
      const r = await lagreTelefon(nummer);
      if (r?.feil) setFeil(r.feil);
      else setLagret(true);
    });
  }

  return (
    <div>
      <label htmlFor="telefon" className="text-sm font-medium text-blekk">
        Telefon
      </label>
      <p className="mt-0.5 text-[13px] text-dempet">
        Valgfritt. Klar for SMS-påminnelser og -innlogging senere.
      </p>
      <input
        id="telefon"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={nummer}
        maxLength={20}
        placeholder="412 34 567"
        onChange={(e) => {
          setNummer(e.target.value);
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
        lagret &&
        !venter && <p className="mt-1.5 text-[13px] text-trygg">Lagret</p>
      )}
    </div>
  );
}
