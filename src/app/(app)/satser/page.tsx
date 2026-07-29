import { NavLenke as Link } from "@/components/NavLenke";
import { ChevronLeft } from "lucide-react";
import { Skjermramme, Sekvens, SekvensDel } from "@/components/ui";
import { satserForDato } from "@/lib/gebyr";
import { formaterDato } from "@/lib/dato";

/** Norsk beløp med tusenskille, uten øre. */
function kr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

/**
 * «Satsene vi bruker» (MEDHOLD_SUBSTANS_ARBEIDSORDRE §6) — alt generert fra
 * SATSVERSJONER, ingen hardkodede tall. Nås fra Utregning sin kildelinje og
 * Meg → Hjelp. Endres satstabellen, endres denne siden med den.
 */
export default function SatserPage() {
  const sats = satserForDato(null);

  return (
    <Skjermramme className="pt-5" animerInn={false}>
      <Link
        href="/meg"
        className="mb-3.5 flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Meg
      </Link>

      <Sekvens>
        <SekvensDel>
          <h1 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
            Satsene vi bruker
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
            Alle kontroller i Medhold gjøres mot disse satsene. De er
            offentlige og fastsatt i inkassoforskriften.
          </p>
        </SekvensDel>

        <SekvensDel>
          <div className="mt-5 rounded-2xl border-[0.5px] border-strek bg-flate p-[18px]">
            <p className="eyebrow mb-3">
              Gjeldende fra {formaterDato(sats.gyldigFra)}
            </p>
            <dl className="flex flex-col gap-2 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-dempet">Inkassosats</dt>
                <dd className="tabular-nums text-blekk">
                  {kr(sats.inkassosats)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-dempet">Purregebyr</dt>
                <dd className="tabular-nums text-blekk">
                  {kr(sats.purregebyr)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-dempet">Inkassovarsel</dt>
                <dd className="tabular-nums text-blekk">
                  {kr(sats.inkassovarselGebyr)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-dempet">Betalingsoppfordring</dt>
                <dd className="tabular-nums text-blekk">
                  {kr(sats.betalingsoppfordringGebyr)} kr
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-dempet">Rettsgebyr</dt>
                <dd className="tabular-nums text-blekk">
                  {kr(sats.rettsgebyr)} kr
                </dd>
              </div>
            </dl>
          </div>
        </SekvensDel>

        <SekvensDel>
          <div className="mt-5">
            <h2 className="font-serif text-[17px] font-semibold text-blekk">
              Salærtrinn for forbruker
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-dempet">
              Hvilken tabell som gjelder avhenger av om kreditor har
              fradragsrett for merverdiavgift (A) eller ikke (B). Innenfor
              hver tabell skiller satsen mellom «enkel» og «tung» sak.
            </p>

            {(
              [
                { bokstav: "A", forklaring: "kreditor har fradragsrett for mva", enkel: "enkelA", tung: "tungA" },
                { bokstav: "B", forklaring: "kreditor har ikke fradragsrett for mva", enkel: "enkelB", tung: "tungB" },
              ] as const
            ).map((tabell) => (
              <div
                key={tabell.bokstav}
                className="mt-3 overflow-hidden rounded-2xl border-[0.5px] border-strek bg-flate"
              >
                <p className="border-b-[0.5px] border-strek px-3.5 py-2.5 text-[13px] font-medium text-blekk">
                  Tabell {tabell.bokstav}{" "}
                  <span className="font-normal text-dempet">
                    — {tabell.forklaring}
                  </span>
                </p>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-dempet">
                      <th className="px-3.5 py-2 text-left font-normal">
                        Hovedstol t.o.m.
                      </th>
                      <th className="px-3.5 py-2 text-right font-normal">
                        Enkel sak
                      </th>
                      <th className="px-3.5 py-2 text-right font-normal">
                        Tung sak
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sats.salaerForbruker.map((trinn, i) => (
                      <tr key={i} className="border-t-[0.5px] border-strek">
                        <td className="px-3.5 py-2 tabular-nums text-blekk">
                          {trinn.hovedstolTom === null
                            ? "over " + kr(sats.salaerForbruker[i - 1]?.hovedstolTom ?? 0)
                            : kr(trinn.hovedstolTom)}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-blekk">
                          {kr(trinn[tabell.enkel])}
                        </td>
                        <td className="px-3.5 py-2 text-right tabular-nums text-blekk">
                          {kr(trinn[tabell.tung])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12px] text-dempet">
            Kilde:{" "}
            <a
              href={sats.kilde}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-strek underline-offset-2 hover:decoration-aksent"
            >
              Finanstilsynet
            </a>
            .
          </p>
          <p className="mt-1 text-[11px] text-dempet">
            Automatisk kontroll — ikke profesjonell rådgivning.
          </p>
        </SekvensDel>
      </Sekvens>
    </Skjermramme>
  );
}
