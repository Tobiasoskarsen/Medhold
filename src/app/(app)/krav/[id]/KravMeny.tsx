"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Check } from "lucide-react";
import { markerLost, slettKrav } from "../actions";
import { UTFALL_VALGBARE, UTFALL_ETIKETT, type SakUtfall } from "@/lib/types";

/** Meny oppe til høyre på kravsiden: marker som løst (med valgfritt utfall) +
 *  sletting, bak et MoreVertical-ikon. */
export function KravMeny({ kravId, lost }: { kravId: string; lost: boolean }) {
  const [åpen, setÅpen] = useState(false);
  const [modus, setModus] = useState<"meny" | "utfall" | "slett">("meny");
  const [venter, startTransition] = useTransition();

  function apne() {
    setModus("meny");
    setÅpen((v) => !v);
  }

  function fullfor(utfall: SakUtfall | null) {
    // Flagg til seremonien (LostNode) at dette er en fersk «marker som løst».
    try {
      sessionStorage.setItem(`medhold-lost-nettopp-${kravId}`, "1");
    } catch {
      /* ignorer */
    }
    setÅpen(false);
    startTransition(async () => {
      await markerLost(kravId, utfall);
    });
  }

  const valgKlasse =
    "block w-full px-4 py-2.5 text-left text-sm text-blekk transition hover:bg-strek/40 disabled:opacity-50";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Mer"
        aria-haspopup="menu"
        aria-expanded={åpen}
        onClick={apne}
        className="rounded-full p-1.5 text-dempet transition hover:bg-strek/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
      >
        <MoreVertical className="size-5" aria-hidden />
      </button>

      {åpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border-[0.5px] border-strek bg-flate py-1 shadow-lg"
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
                className="block w-full px-4 py-2.5 text-left text-sm text-red-700 transition hover:bg-strek/40"
              >
                Slett kravet
              </button>
            </>
          )}

          {modus === "utfall" && (
            <>
              <p className="px-4 py-2 text-xs text-dempet">
                Hvordan endte saken?
              </p>
              {UTFALL_VALGBARE.map((u) => (
                <button
                  key={u}
                  type="button"
                  role="menuitem"
                  disabled={venter}
                  onClick={() => fullfor(u)}
                  className={valgKlasse}
                >
                  {UTFALL_ETIKETT[u]}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                disabled={venter}
                onClick={() => fullfor(null)}
                className={`${valgKlasse} text-dempet`}
              >
                Annet / vet ikke
              </button>
            </>
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
