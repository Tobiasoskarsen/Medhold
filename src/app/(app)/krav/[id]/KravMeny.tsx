"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Check } from "lucide-react";
import { markerLost, slettKrav } from "../actions";

/** Meny oppe til høyre på kravsiden: marker som løst + sletting bak et
 *  MoreVertical-ikon. */
export function KravMeny({ kravId, lost }: { kravId: string; lost: boolean }) {
  const [åpen, setÅpen] = useState(false);
  const [bekreft, setBekreft] = useState(false);
  const [venter, startTransition] = useTransition();

  function markerLostKlikk() {
    // Flagg til seremonien (LostNode) at dette er en fersk «marker som løst».
    try {
      sessionStorage.setItem(`medhold-lost-nettopp-${kravId}`, "1");
    } catch {
      /* ignorer */
    }
    setÅpen(false);
    startTransition(async () => {
      await markerLost(kravId);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Mer"
        aria-haspopup="menu"
        aria-expanded={åpen}
        onClick={() => setÅpen((v) => !v)}
        className="rounded-full p-1.5 text-dempet transition hover:bg-strek/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
      >
        <MoreVertical className="size-5" aria-hidden />
      </button>

      {åpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-xl border-[0.5px] border-strek bg-flate py-1 shadow-lg"
        >
          {!bekreft ? (
            <>
              {!lost && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={venter}
                  onClick={markerLostKlikk}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blekk transition hover:bg-strek/40 disabled:opacity-50"
                >
                  <Check className="size-4 text-aksent" aria-hidden />
                  Marker som løst
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => setBekreft(true)}
                className="block w-full px-4 py-2.5 text-left text-sm text-red-700 transition hover:bg-strek/40"
              >
                Slett kravet
              </button>
            </>
          ) : (
            <form action={slettKrav}>
              <input type="hidden" name="id" value={kravId} />
              <p className="px-4 py-2 text-xs text-dempet">
                Sikker? Dette kan ikke angres.
              </p>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 transition hover:bg-strek/40"
              >
                Ja, slett kravet
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
