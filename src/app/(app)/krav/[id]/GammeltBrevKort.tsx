"use client";

import { useEffect, useState } from "react";
import { Kort, Primærknapp } from "@/components/ui";

const nokkel = (brevId: string) => `medhold-gammelt-ok-${brevId}`;

/**
 * Rolig kort over Veivalg når sakens nyeste brev er mer enn 45 dager gammelt
 * (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2). Ber brukeren legge til det nyeste
 * brevet, så vurderingen ikke bygger på et utdatert brev. «Nei, dette er det
 * nyeste» skjuler kortet for dette brevet (localStorage, lest i useEffect for
 * å unngå hydreringsfeil — serveren vet ikke hva som er lagret).
 */
export function GammeltBrevKort({
  brevId,
  kravId,
  datoTekst,
  uker,
  className = "",
}: {
  brevId: string;
  kravId: string;
  /** Lang dato, f.eks. «20. juli». */
  datoTekst: string;
  uker: number;
  className?: string;
}) {
  // Skjult til localStorage er lest: et kort som blinker frem og forsvinner
  // igjen er verre enn et som kommer et øyeblikk senere.
  const [skjult, setSkjult] = useState(true);

  useEffect(() => {
    let ok = false;
    try {
      ok = localStorage.getItem(nokkel(brevId)) === "1";
    } catch {
      /* privat modus o.l. — vis kortet */
    }
    // Lesing av lagret valg etter hydrering (bevisst setState i effekt).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSkjult(ok);
  }, [brevId]);

  if (skjult) return null;

  return (
    <Kort className={className}>
      <h2 className="seksjonstittel text-blekk">Dette brevet er fra {datoTekst}</h2>
      <p className="mt-1 text-[13.5px] text-dempet">
        Det er {uker} uker siden. Har du fått nye brev om saken? Legg til det
        nyeste, så blir vurderingen riktig.
      </p>
      <Primærknapp
        href={`/legg-til-brev?krav=${kravId}`}
        variant="rolig"
        className="mt-3.5"
      >
        Legg til nyere brev
      </Primærknapp>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(nokkel(brevId), "1");
          } catch {
            /* ignorer — kortet skjules uansett for denne visningen */
          }
          setSkjult(true);
        }}
        className="mt-3 block w-full text-center text-[13px] text-dempet underline decoration-strek underline-offset-4 transition hover:text-blekk"
      >
        Nei, dette er det nyeste
      </button>
    </Kort>
  );
}
