"use client";

import { useRef, useState } from "react";
import { MoreHorizontal, Check, Trash2 } from "lucide-react";
import { Bunnark } from "@/components/ui/Bunnark";
import { HoldKnapp } from "@/components/ui/HoldKnapp";
import { slettKrav } from "../actions";
import { UtfallVelger } from "./UtfallVelger";

const RAD =
  "trykk flex w-full items-center gap-3 rounded-kontroll px-3 py-3.5 text-left text-brod transition hover:bg-flate-2";

/** Meny oppe til høyre på kravsiden: marker som løst (med valgfritt utfall) +
 *  sletting, bak et MoreHorizontal-ikon. Åpnes som et bunnark (visuell
 *  ordre, fase 2) — lett å nå med tommelen, og kan dras ned for å lukkes. */
export function KravMeny({ kravId, lost }: { kravId: string; lost: boolean }) {
  const [åpen, setÅpen] = useState(false);
  const [modus, setModus] = useState<"meny" | "utfall" | "slett">("meny");
  const skjema = useRef<HTMLFormElement | null>(null);

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
        className="trykk -mr-2.5 flex size-11 items-center justify-center text-blekk"
      >
        <MoreHorizontal className="size-6" strokeWidth={2} aria-hidden />
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
          <form ref={skjema} action={slettKrav} className="flex flex-col gap-2 px-1">
            <input type="hidden" name="id" value={kravId} />
            <p className="text-[13.5px] text-dempet">
              Kravet, brevene og utkastene slettes. Dette kan ikke angres.
            </p>
            {/* Hold inne for å slette (HoldKnapp) — et uhell-trykk i arket
                kan ikke slette en sak. Fullført hold sender skjemaet. */}
            <div className="mt-2">
              <HoldKnapp
                holdTime={1500}
                doneLabel="Sletter …"
                onHold={() => skjema.current?.requestSubmit()}
              >
                Hold for å slette kravet
              </HoldKnapp>
            </div>
            <button
              type="button"
              onClick={() => setModus("meny")}
              className="trykk w-full rounded-kontroll px-4 py-3 text-brod font-medium text-blekk"
            >
              Avbryt
            </button>
          </form>
        )}
      </Bunnark>
    </>
  );
}
