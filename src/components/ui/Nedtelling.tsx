import { dagerTil } from "@/lib/dato";

/** «24. juli» — dag + full måned, uten år (som i mockupen). */
function langDato(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Nedtelling — fristkort: dato i serif venstre + hva fristen gjelder, antall
 * dager i stor serif høyre. Tallet er `dom-rod` KUN når ≤10 dager gjenstår
 * (eller fristen er passert); ellers `blekk`.
 */
export function Nedtelling({
  forfallsdato,
  tittel,
  className = "",
}: {
  forfallsdato: string;
  tittel: string;
  className?: string;
}) {
  const d = dagerTil(forfallsdato);
  const rod = d <= 10; // ≤10 dager igjen, i dag, eller utløpt
  const tallFarge = rod ? "text-dom-rod" : "text-blekk";

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border-[0.5px] border-strek bg-flate px-4 py-3.5 ${className}`}
    >
      <div className="min-w-0">
        <p className="font-serif text-[19px] font-semibold text-blekk">
          {langDato(forfallsdato)}
        </p>
        <p className="mt-0.5 text-[12px] text-dempet">{tittel}</p>
      </div>
      <div className="shrink-0 text-right">
        {d < 0 ? (
          <p className={`font-serif text-[26px] font-semibold ${tallFarge}`}>
            Utløpt
          </p>
        ) : d === 0 ? (
          <p className={`font-serif text-[26px] font-semibold ${tallFarge}`}>
            I dag
          </p>
        ) : (
          <>
            <span
              className={`font-serif text-[26px] font-semibold leading-none tabular-nums ${tallFarge}`}
            >
              {d}
            </span>
            <span className="mt-0.5 block text-[12px] font-semibold text-dempet">
              {d === 1 ? "dag igjen" : "dager igjen"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
