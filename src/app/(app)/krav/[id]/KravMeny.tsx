"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { slettKrav } from "../actions";

/** Meny oppe til høyre på kravsiden: sletting bak et MoreVertical-ikon. */
export function KravMeny({ kravId }: { kravId: string }) {
  const [åpen, setÅpen] = useState(false);
  const [bekreft, setBekreft] = useState(false);

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
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border-[0.5px] border-strek bg-flate py-1 shadow-lg"
        >
          {!bekreft ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => setBekreft(true)}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-700 transition hover:bg-strek/40"
            >
              Slett kravet
            </button>
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
