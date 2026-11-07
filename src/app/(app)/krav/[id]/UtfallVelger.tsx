"use client";

import { useState, useTransition } from "react";
import { Primærknapp } from "@/components/ui";
import { settUtfall } from "../actions";
import { UTFALL_VALGBARE, UTFALL_ETIKETT, type SakUtfall } from "@/lib/types";
import { utfallAvslutter } from "@/lib/utfall";

/**
 * Utfallsvelgeren for en sak. Brukt av BÅDE `KravMeny` og «venter på svar»-kortet
 * på krav-siden. Utfall som lar saken stå åpen lagres med én gang. Utfall som
 * avslutter saken må bekreftes i et eget steg (også håndhevet på serveren).
 */
export function UtfallVelger({
  kravId,
  onFerdig,
  iMeny = false,
  visTittel = true,
}: {
  kravId: string;
  onFerdig?: () => void;
  /** Rendres inni en `role="menu"` (KravMeny) — gir knappene `role="menuitem"`. */
  iMeny?: boolean;
  /** Skjul «Hvordan endte saken?» når forelderen allerede viser den (Bunnark). */
  visTittel?: boolean;
}) {
  const [venter, startTransition] = useTransition();
  const [tilBekreftelse, setTilBekreftelse] = useState<{ utfall: SakUtfall | null } | null>(
    null,
  );
  const [feil, setFeil] = useState<string | null>(null);
  const seremoni = `medhold-lost-nettopp-${kravId}`;

  function lagre(utfall: SakUtfall | null, bekreftet: boolean) {
    setFeil(null);
    // Flagg til seremonien (LostNode) settes før kallet: siden tegnes på nytt
    // før svaret er tilbake. Fjernes igjen hvis lagringen feiler.
    if (bekreftet) {
      try {
        sessionStorage.setItem(seremoni, "1");
      } catch {
        /* ignorer */
      }
    }
    startTransition(async () => {
      const r = await settUtfall(kravId, utfall, bekreftet);
      if (!r.ok) {
        try {
          sessionStorage.removeItem(seremoni);
        } catch {
          /* ignorer */
        }
        setFeil(r.feil);
        return;
      }
      setTilBekreftelse(null);
      onFerdig?.();
    });
  }

  function velg(utfall: SakUtfall | null) {
    if (utfallAvslutter(utfall)) setTilBekreftelse({ utfall });
    else lagre(utfall, false);
  }

  const valgKlasse =
    "block w-full px-4 py-2.5 text-left text-sm text-blekk transition hover:bg-strek/40 disabled:opacity-50";

  if (tilBekreftelse) {
    const u = tilBekreftelse.utfall;
    return (
      <div className="px-4 py-2">
        <p className="text-sm font-medium text-blekk">
          {u ? `Avslutte saken som «${UTFALL_ETIKETT[u]}»?` : "Avslutte saken?"}
        </p>
        <p className="mt-1 text-hjelp leading-relaxed text-dempet">
          Saken flyttes til Avsluttet, og du får ikke flere fristvarsler for den.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Primærknapp full={false} disabled={venter} onClick={() => lagre(u, true)}>
            {venter ? "Lagrer …" : "Ja, avslutt saken"}
          </Primærknapp>
          <button
            type="button"
            disabled={venter}
            onClick={() => setTilBekreftelse(null)}
            className="text-hjelp text-dempet transition hover:text-blekk"
          >
            Avbryt
          </button>
        </div>
        {feil && <p className="mt-2 text-hjelp text-dom-rod">{feil}</p>}
      </div>
    );
  }

  return (
    <>
      {visTittel && (
        <p className="px-4 py-2 text-xs text-dempet">Hvordan endte saken?</p>
      )}
      {UTFALL_VALGBARE.map((u) => (
        <button
          key={u}
          type="button"
          role={iMeny ? "menuitem" : undefined}
          disabled={venter}
          onClick={() => velg(u)}
          className={valgKlasse}
        >
          {UTFALL_ETIKETT[u]}
          <span className="block text-xs text-dempet">
            {utfallAvslutter(u) ? "Avslutter saken" : "Saken forblir åpen"}
          </span>
        </button>
      ))}
      <button
        type="button"
        role={iMeny ? "menuitem" : undefined}
        disabled={venter}
        onClick={() => velg(null)}
        className={`${valgKlasse} text-dempet`}
      >
        Annet / vet ikke
        <span className="block text-xs text-dempet">Avslutter saken</span>
      </button>
      {feil && <p className="px-4 py-2 text-hjelp text-dom-rod">{feil}</p>}
    </>
  );
}
