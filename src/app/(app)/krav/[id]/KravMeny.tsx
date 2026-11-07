"use client";

import { useRef, useState, useTransition } from "react";
import { MoreHorizontal, Check, Trash2 } from "lucide-react";
import { Bunnark } from "@/components/ui/Bunnark";
import { HoldKnapp } from "@/components/ui/HoldKnapp";
import { Primærknapp } from "@/components/ui";
import type { SakUtfall } from "@/lib/types";
import { gjenapneKrav, settUtfall, slettKrav } from "../actions";
import { UtfallVelger } from "./UtfallVelger";

const RAD =
  "trykk flex w-full items-center gap-3 rounded-kontroll px-3 py-3.5 text-left text-brod transition hover:bg-flate-2";

/** Meny oppe til høyre på kravsiden: registrer utfall, marker en akseptert
 *  avtale som ferdig betalt, og sletting, bak et MoreHorizontal-ikon. Åpnes som et bunnark (visuell
 *  ordre, fase 2) — lett å nå med tommelen, og kan dras ned for å lukkes. */
export function KravMeny({
  kravId,
  lost,
  utfall = null,
  sistEndret,
}: {
  kravId: string;
  lost: boolean;
  utfall?: SakUtfall | null;
  /** Sakens sist_endret da siden ble lest (samtidighetsvern). */
  sistEndret: string;
}) {
  const [åpen, setÅpen] = useState(false);
  const [modus, setModus] = useState<"meny" | "utfall" | "slett" | "betalt" | "apne">(
    "meny",
  );
  const skjema = useRef<HTMLFormElement | null>(null);
  const [betaler, startBetaling] = useTransition();
  const [feil, setFeil] = useState<string | null>(null);
  // En akseptert avtale kan registreres som ferdig betalt. Eldre avtaler kan
  // være avsluttet fra før, nye er åpne til de er oppgjort.
  const kanRegistrereBetalt = utfall === "nedbetalingsavtale";

  function apneIgjen() {
    setFeil(null);
    startBetaling(async () => {
      const r = await gjenapneKrav(kravId, sistEndret);
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      setÅpen(false);
    });
  }

  function registrerBetalt() {
    setFeil(null);
    startBetaling(async () => {
      const r = await settUtfall(kravId, "oppgjort", true, sistEndret);
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      setÅpen(false);
    });
  }

  function apne() {
    setModus("meny");
    setÅpen(true);
  }

  const tittel =
    modus === "utfall"
      ? "Hvordan endte saken?"
      : modus === "slett"
        ? "Slette kravet?"
        : modus === "betalt"
          ? "Er avtalen ferdig betalt?"
          : modus === "apne"
            ? "Åpne saken igjen?"
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
                Registrer utfall
              </button>
            )}
            {lost && (
              <button
                type="button"
                onClick={() => setModus("apne")}
                className={`${RAD} text-blekk`}
              >
                <Check className="size-[18px] text-aksent" aria-hidden />
                Åpne saken igjen
              </button>
            )}
            {kanRegistrereBetalt && (
              <button
                type="button"
                onClick={() => setModus("betalt")}
                className={`${RAD} text-blekk`}
              >
                <Check className="size-[18px] text-aksent" aria-hidden />
                Avtalen er ferdig betalt
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
            sistEndret={sistEndret}
            onFerdig={() => setÅpen(false)}
            visTittel={false}
          />
        )}

        {modus === "betalt" && (
          <div className="flex flex-col gap-2 px-1">
            <p className="text-[13.5px] text-dempet">
              Registrer at hele nedbetalingsavtalen er betalt. Saken avsluttes
              som oppgjort, og fristvarslene stopper.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Primærknapp full={false} disabled={betaler} onClick={registrerBetalt}>
                {betaler ? "Lagrer …" : "Ja, registrer betalingen"}
              </Primærknapp>
              <button
                type="button"
                onClick={() => setModus("meny")}
                className="text-hjelp text-dempet transition hover:text-blekk"
              >
                Avbryt
              </button>
            </div>
            {feil && <p className="text-hjelp text-dom-rod">{feil}</p>}
          </div>
        )}

        {modus === "apne" && (
          <div className="flex flex-col gap-2 px-1">
            <p className="text-[13.5px] text-dempet">
              Saken flyttes tilbake til aktive saker, og fristene varsles igjen.
              Utfallet blir stående i historikken.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Primærknapp full={false} disabled={betaler} onClick={apneIgjen}>
                {betaler ? "Lagrer …" : "Ja, åpne saken"}
              </Primærknapp>
              <button
                type="button"
                onClick={() => setModus("meny")}
                className="text-hjelp text-dempet transition hover:text-blekk"
              >
                Avbryt
              </button>
            </div>
            {feil && <p className="text-hjelp text-dom-rod">{feil}</p>}
          </div>
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
