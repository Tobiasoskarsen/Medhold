/**
 * StadiumIndikator — 5 avrundede striper som viser hvor langt et gjeldskrav
 * har eskalert. `fylt` segmenter tegnes i aksentfarge, resten i strek.
 *
 * Rent presentasjonelt: mapping fra stadium → antall fylte segmenter og
 * neste-stadium-tekst gjøres i `src/lib/gjeld.ts` (Fase 1) og sendes hit.
 */
export function StadiumIndikator({
  fylt,
  total = 5,
  stadium,
  neste,
}: {
  fylt: number;
  total?: number;
  stadium?: string;
  neste?: string;
}) {
  return (
    <div>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-sm ${
              i < fylt ? "bg-aksent" : "bg-strek"
            }`}
          />
        ))}
      </div>
      {stadium && (
        <p className="mt-1.5 text-xs text-dempet">
          Stadium: {stadium}
          {neste ? ` · neste er ${neste}` : ""}
        </p>
      )}
    </div>
  );
}
