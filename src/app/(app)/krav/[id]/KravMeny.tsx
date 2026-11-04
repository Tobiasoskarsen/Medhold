"use client";

import { useState } from "react";
import { MoreHorizontal, Check, Trash2 } from "lucide-react";
import { Bunnark } from "@/components/ui/Bunnark";
import { slettKrav } from "../actions";
import { UtfallVelger } from "./UtfallVelger";

const RAD =
  "trykk flex w-full items-center gap-3 rounded-[14px] px-3 py-3.5 text-left text-[15px] transition hover:bg-flate-2";

/** Meny oppe til høyre på kravsiden: marker som løst (med valgfritt utfall) +
 *  sletting, bak et MoreHorizontal-ikon. Åpnes som et bunnark (visuell
 *  ordre, fase 2) — lett å nå med tommelen, og kan dras ned for å lukkes. */
export function KravMeny({ kravId, lost }: { kravId: string; lost: boolean }) {
  const [åpen, setÅpen] = useState(false);
  const [modus, setModus] = useState<"meny" | "utfall" | "slett">("meny");

  function apne() {
    setModus("meny");
    setÅpen(true);
  }

  const tittel =
    modus === "utfall"
      ? "Hvordan endte saken?"
      : modus === "slett"
        ? "Slette kravet?"
        : "Saken";

  return (
    <>
      <button
        type="button"
        aria-label="Mer"
        aria-haspopup="dialog"
        aria-expanded={åpen}
        onClick={apne}
        className="trykk flex size-9 items-center justify-center rounded-full border border-kant bg-flate text-blekk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk"
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>

      <Bunnark apen={åpen} onLukk={() => setÅpen(false)} tittel={tittel}>
        {modus === "meny" && (
          <div className="flex flex-col">
            {!lost && (
              <button
                type="button"
                onClick={() => setModus("utfall")}
                className={`${RAD} text-blekk`}
              >
                <Check className="size-[18px] text-aksent" aria-hidden />
                Marker som løst
              </button>
            )}
            <button
              type="button"
              onClick={() => setModus("slett")}
              className={`${RAD} text-dom-rod`}
            >
              <Trash2 className="size-[18px]" aria-hidden />
              Slett kravet
            </button>
          </div>
        )}

        {modus === "utfall" && (
          <UtfallVelger
            kravId={kravId}
            onFerdig={() => setÅpen(false)}
            visTittel={false}
          />
        )}

        {modus === "slett" && (
          <form action={slettKrav} className="flex flex-col gap-2 px-1">
            <input type="hidden" name="id" value={kravId} />
            <p className="text-[13.5px] text-dempet">
              Kravet, brevene og utkastene slettes. Dette kan ikke angres.
            </p>
            <button
              type="submit"
              className="trykk mt-2 w-full rounded-[16px] border-[1.5px] border-dom-rod bg-dom-rod-bg px-4 py-[15px] text-[15px] font-bold text-dom-rod"
            >
              Ja, slett kravet
            </button>
            <button
              type="button"
              onClick={() => setModus("meny")}
              className="trykk w-full rounded-[16px] px-4 py-3 text-[15px] font-medium text-blekk"
            >
              Avbryt
            </button>
          </form>
        )}
      </Bunnark>
    </>
  );
}
