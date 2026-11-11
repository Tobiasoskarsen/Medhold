import { NavLenke as Link } from "@/components/NavLenke";
import { ChevronLeft } from "lucide-react";
import { Kort, Skjermramme, Sekvens, SekvensDel } from "@/components/ui";
import { satserForDato } from "@/lib/gebyr";
import { formaterDato, idagOslo } from "@/lib/dato";
import { formaterKr } from "@/lib/format";
import { FORBEHOLD } from "@/lib/brand";

/** Norsk beløp med tusenskille, øre med to sifre når det finnes. */
function kr(n: number): string {
  return formaterKr(n);
}

/**
 * «Satsene vi bruker» (MEDHOLD_SUBSTANS_ARBEIDSORDRE §6) — alt generert fra
 * SATSVERSJONER, ingen hardkodede tall. Nås fra Utregning sin kildelinje og
 * Meg → Hjelp. Endres satstabellen, endres denne siden med den.
 */
export default function SatserPage() {
  const idag = idagOslo();
  const sats = satserForDato(idag);

  const tilbake = (
    <Link
      href="/meg"
      className="mb-3.5 flex items-center gap-1 text-hjelp text-dempet transition hover:text-blekk"
    >
      <ChevronLeft className="size-5" aria-hidden />
      Meg
    </Link>
  );

  if (!sats) {
    return (
      <Skjermramme className="pt-5" animerInn={false}>
        {tilbake}
        <h1 className="tittel-s text-blekk">Satsene vi bruker</h1>
        <Kort className="mt-5">
          <h2 className="seksjonstittel text-blekk">
            Satsene for {idag.slice(0, 4)} er ikke lagt inn ennå
          </h2>
          <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
            Inntil de nye satsene er lagt inn, vurderer vi ikke gebyrer i brev
            fra i år. Gebyrsjekken sier da «Ikke kontrollert» i stedet for å
            bruke fjorårets tall.
          </p>
        </Kort>
      </Skjermramme>
    );
  }

  return (
    <Skjermramme className="pt-5" animerInn={false}>
      {tilbake}

      <Sekvens>
        <SekvensDel>
          <h1 className="tittel-s text-blekk">
            Satsene vi bruker
          </h1>
          <p className="mt-1.5 text-hjelp leading-relaxed text-dempet">
            Alle kontroller i Medhold gjøres mot disse satsene. De er
            offentlige og fastsatt i inkassoforskriften.
          </p>
        </SekvensDel>

        <SekvensDel>
          <div className="mt-5 rounded-kort border-[0.5px] border-strek bg-flate p-[18px]">
            <p className="eyebrow mb-3">
              Gjelder {formaterDato(sats.gyldigFra)} –{" "}
              {formaterDato(sats.gyldigTil)}
            </p>
            <dl className="flex flex-col gap-2 text-hjelp">
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
            <h2 className="seksjonstittel text-blekk">
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
                className="mt-3 overflow-hidden rounded-kort border-[0.5px] border-strek bg-flate"
              >
                <p className="border-b-[0.5px] border-strek px-3.5 py-2.5 text-hjelp font-medium text-blekk">
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

          <p className="mt-4 text-meta text-dempet">
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
          <p className="mt-1 text-meta text-dempet">{FORBEHOLD}</p>
        </SekvensDel>
      </Sekvens>
    </Skjermramme>
  );
}
