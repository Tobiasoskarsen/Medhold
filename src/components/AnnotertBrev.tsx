"use client";

// Annotert brev (MEDHOLD_SUBSTANS_ARBEIDSORDRE §4.2) — original brevtekst med
// kjente verdier markert. Trykk viser etiketten rett under, ikke som modal.
// Ett åpent om gangen. Ingen annoteringer → teksten vises helt uendret.
import { Fragment, useState, type ReactNode } from "react";
import type { Annotering } from "@/lib/annotering";

export function AnnotertBrev({
  tekst,
  annoteringer,
  className = "",
}: {
  tekst: string;
  annoteringer: Annotering[];
  className?: string;
}) {
  const [åpenIndeks, setÅpenIndeks] = useState<number | null>(null);

  if (annoteringer.length === 0) {
    return <p className={`whitespace-pre-line ${className}`}>{tekst}</p>;
  }

  const deler: ReactNode[] = [];
  let cursor = 0;
  annoteringer.forEach((a, i) => {
    if (a.start > cursor) deler.push(tekst.slice(cursor, a.start));
    const åpen = åpenIndeks === i;
    const popoverId = `annotering-popover-${i}`;
    const erFunn = a.type === "funn";
    deler.push(
      <span key={i}>
        <button
          type="button"
          onClick={() => setÅpenIndeks(åpen ? null : i)}
          aria-expanded={åpen}
          aria-describedby={åpen ? popoverId : undefined}
          className={`trykk rounded px-0.5 underline decoration-dotted underline-offset-2 ${
            erFunn
              ? "bg-dom-rod-bg text-dom-rod decoration-dom-rod"
              : "bg-strek/60 text-blekk decoration-dempet"
          }`}
        >
          {tekst.slice(a.start, a.slutt)}
        </button>
        {åpen && (
          <span
            id={popoverId}
            role="note"
            className="mt-1 block rounded-lg border-[0.5px] border-strek bg-flate px-2.5 py-2 text-[12.5px] leading-snug text-blekk"
          >
            {a.etikett}
          </span>
        )}
      </span>,
    );
    cursor = a.slutt;
  });
  if (cursor < tekst.length) deler.push(tekst.slice(cursor));

  return (
    <Fragment>
      <p className="mb-2 text-[12px] text-dempet">
        Trykk på de markerte tallene for å se hva de er.
      </p>
      <p className={`whitespace-pre-line ${className}`}>{deler}</p>
    </Fragment>
  );
}
