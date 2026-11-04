import { CalendarDays } from "lucide-react";
import { dagerTil, formaterTallDato } from "@/lib/dato";
import { erHastende, fristChipTekst } from "@/lib/frist";

/** «11. november» — dag + full måned, uten år. */
function langDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}

/**
 * FristRad — én rolig rad med hva fristen gjelder, datoen, og en dagpill
 * til høyre (Retning B §4.7). Erstatter Nedtelling på saken. Pillen er
 * dom-rød KUN når fristen er hastende (≤10 dager eller passert).
 */
export function FristRad({
  forfallsdato,
  tittel,
  gammeltBrev = false,
  className = "",
}: {
  forfallsdato: string;
  tittel: string;
  /** Brevet fristen kom fra er mer enn 45 dager gammelt (erGammeltBrev). En
   *  utløpt frist er da historikk: nøytral pille «Utløpt {dato}», ikke rød. */
  gammeltBrev?: boolean;
  className?: string;
}) {
  const d = dagerTil(forfallsdato);
  const historisk = d < 0 && gammeltBrev;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-kort border border-kant bg-flate px-4 py-3 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-liten bg-flate-2" aria-hidden>
          <CalendarDays className="size-[18px] text-dempet" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="radtekst truncate">{tittel}</p>
          <p className="text-brod font-bold text-blekk">{langDato(forfallsdato)}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-hjelp font-bold ${
          erHastende(d) && !historisk
            ? "bg-dom-rod-bg text-dom-rod"
            : "bg-flate-2 text-dempet"
        }`}
      >
        {historisk ? `Utløpt ${formaterTallDato(forfallsdato)}` : fristChipTekst(d)}
      </span>
    </div>
  );
}
