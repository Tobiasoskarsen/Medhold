"use client";

import { useState } from "react";
import { MoreHorizontal, Check } from "lucide-react";
import { slettKrav } from "../actions";
import { UtfallVelger } from "./UtfallVelger";

/** Meny oppe til høyre på kravsiden: marker som løst (med valgfritt utfall) +
 *  sletting, bak et MoreHorizontal-ikon. */
export function KravMeny({ kravId, lost }: { kravId: string; lost: boolean }) {
  const [åpen, setÅpen] = useState(false);
  const [modus, setModus] = useState<"meny" | "utfall" | "slett">("meny");

  function apne() {
    setModus("meny");
    setÅpen((v) => !v);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Mer"
        aria-haspopup="menu"
        aria-expanded={åpen}
        onClick={apne}
        className="trykk flex size-9 items-center justify-center rounded-full border border-kant bg-flate text-blekk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk"
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>

      {åpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-[16px] border border-kant bg-flate py-1 shadow-lg"
        >
          {modus === "meny" && (
            <>
              {!lost && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setModus("utfall")}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blekk transition hover:bg-strek/40"
                >
                  <Check className="size-4 text-aksent" aria-hidden />
                  Marker som løst
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => setModus("slett")}
                className="block w-full px-4 py-2.5 text-left text-sm text-dom-rod transition hover:bg-strek/40"
              >
                Slett kravet
              </button>
            </>
          )}

          {modus === "utfall" && (
            <UtfallVelger
              kravId={kravId}
              onFerdig={() => setÅpen(false)}
              iMeny
            />
          )}

          {modus === "slett" && (
            <form action={slettKrav}>
              <input type="hidden" name="id" value={kravId} />
              <p className="px-4 py-2 text-xs text-dempet">
                Sikker? Dette kan ikke angres.
              </p>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-dom-rod transition hover:bg-strek/40"
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
