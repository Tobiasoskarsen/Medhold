"use client";

import { useTransition } from "react";
import { markerLost } from "../actions";
import { UTFALL_VALGBARE, UTFALL_ETIKETT, type SakUtfall } from "@/lib/types";

/**
 * Utfallsvelgeren for «marker som løst» — eneste plass `markerLost` kalles
 * fra UI (MEDHOLD_SAKSTATUS_SYNLIG_ARBEIDSORDRE §1/guardrail 2). Brukt av
 * BÅDE `KravMeny` (i «utfall»-modus) og «venter på svar»-kortet på
 * krav-siden. `onFerdig` kalles etter `markerLost` — f.eks. for å lukke en
 * meny; ikke nødvendig når siden uansett re-rendres via revalidatePath.
 */
export function UtfallVelger({
  kravId,
  onFerdig,
  iMeny = false,
}: {
  kravId: string;
  onFerdig?: () => void;
  /** Rendres inni en `role="menu"` (KravMeny) — gir knappene `role="menuitem"`. */
  iMeny?: boolean;
}) {
  const [venter, startTransition] = useTransition();

  function fullfor(utfall: SakUtfall | null) {
    // Flagg til seremonien (LostNode) at dette er en fersk «marker som løst».
    try {
      sessionStorage.setItem(`medhold-lost-nettopp-${kravId}`, "1");
    } catch {
      /* ignorer */
    }
    onFerdig?.();
    startTransition(async () => {
      await markerLost(kravId, utfall);
    });
  }

  const valgKlasse =
    "block w-full px-4 py-2.5 text-left text-sm text-blekk transition hover:bg-strek/40 disabled:opacity-50";

  return (
    <>
      <p className="px-4 py-2 text-xs text-dempet">Hvordan endte saken?</p>
      {UTFALL_VALGBARE.map((u) => (
        <button
          key={u}
          type="button"
          role={iMeny ? "menuitem" : undefined}
          disabled={venter}
          onClick={() => fullfor(u)}
          className={valgKlasse}
        >
          {UTFALL_ETIKETT[u]}
        </button>
      ))}
      <button
        type="button"
        role={iMeny ? "menuitem" : undefined}
        disabled={venter}
        onClick={() => fullfor(null)}
        className={`${valgKlasse} text-dempet`}
      >
        Annet / vet ikke
      </button>
    </>
  );
}
