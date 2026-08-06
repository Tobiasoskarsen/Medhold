"use client";

import { useState, type ComponentProps } from "react";
import { Search, ChevronRight } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";
import { formaterBelop } from "@/lib/format";
import { Kravkort } from "./Kravkort";

export type GruppeRad = {
  id: string;
  tittel: string;
  underTekst: string | null;
  hastende: boolean;
  belop: number | null;
  harFunn: boolean;
};

export type Gruppe = {
  navn: string;
  saker: GruppeRad[];
  samletBelop: number | null;
  harFunn: boolean;
  /** Nærmeste HASTENDE frist blant gruppens saker, klar chip-tekst. Null når
   *  ingen sak i gruppen har en hastende frist (ingen chip vises da). */
  fristTekst: string | null;
};

/**
 * Saklisten gruppert på kreditor — vises KUN når antall aktive saker er høyt
 * (krav-siden avgjør terskelen). Kreditorer med kun ett krav vises separat,
 * uendret, som vanlige `Kravkort` (samme visning som den flate listen).
 */
export function GruppertSaksliste({
  grupper,
  enkeltstaende,
  antallKreditorer,
}: {
  grupper: Gruppe[];
  enkeltstaende: ComponentProps<typeof Kravkort>[];
  antallKreditorer: number;
}) {
  const [sok, setSok] = useState("");
  const [åpne, setÅpne] = useState<ReadonlySet<string>>(new Set());

  const q = sok.trim().toLowerCase();
  const filtrerteGrupper = q
    ? grupper.filter((g) => g.navn.toLowerCase().includes(q))
    : grupper;
  const filtrerteEnkelt = q
    ? enkeltstaende.filter((s) => s.navn.toLowerCase().includes(q))
    : enkeltstaende;
  const ingenTreff =
    q.length > 0 && filtrerteGrupper.length === 0 && filtrerteEnkelt.length === 0;

  function veksle(navn: string) {
    setÅpne((s) => {
      const ny = new Set(s);
      if (ny.has(navn)) ny.delete(navn);
      else ny.add(navn);
      return ny;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border-[0.5px] border-strek bg-flate px-3.5 py-2.5">
        <Search className="size-4 shrink-0 text-dempet" aria-hidden />
        <input
          value={sok}
          onChange={(e) => setSok(e.target.value)}
          placeholder="Søk etter kreditor …"
          className="w-full bg-transparent text-sm text-blekk outline-none placeholder:text-dempet"
        />
      </div>

      {!q && (
        <p className="eyebrow mb-2 mt-4">
          Gruppert på kreditor · {antallKreditorer}{" "}
          {antallKreditorer === 1 ? "kreditor" : "kreditorer"}
        </p>
      )}

      {filtrerteGrupper.length > 0 && (
        <div className={`flex flex-col gap-2.5 ${q ? "mt-4" : ""}`}>
          {filtrerteGrupper.map((g) => {
            const åpen = åpne.has(g.navn);
            return (
              <div
                key={g.navn}
                className="overflow-hidden rounded-2xl border-[0.5px] border-strek bg-flate"
              >
                <button
                  type="button"
                  onClick={() => veksle(g.navn)}
                  aria-expanded={åpen}
                  className="trykk flex w-full items-center gap-3 px-3.5 py-3 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-aksent/10 font-serif text-[15px] font-semibold text-aksent-dyp">
                    {g.navn.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-blekk">
                      <span className="truncate">{g.navn}</span>
                      {g.harFunn && (
                        <span
                          aria-hidden
                          className="font-serif text-[13px] font-semibold leading-none text-dom-rod"
                        >
                          §
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-dempet">
                      {g.saker.length} krav
                    </span>
                    {g.fristTekst && (
                      <span className="mt-1 inline-block rounded-full bg-dom-rod-bg px-2 py-0.5 text-[10.5px] font-semibold text-dom-rod">
                        {g.fristTekst}
                      </span>
                    )}
                  </span>
                  {g.samletBelop != null && (
                    <span className="shrink-0 font-serif text-[17px] font-semibold tabular-nums text-blekk">
                      {formaterBelop(g.samletBelop)} kr
                    </span>
                  )}
                  <ChevronRight
                    className={`size-4 shrink-0 text-dempet transition-transform duration-200 ${
                      åpen ? "rotate-90" : ""
                    }`}
                    aria-hidden
                  />
                </button>

                {åpen && (
                  <div className="border-t-[0.5px] border-strek">
                    {g.saker.map((s) => (
                      <Link
                        key={s.id}
                        href={`/krav/${s.id}`}
                        className="trykk flex items-center justify-between gap-3 border-b-[0.5px] border-strek px-3.5 py-2.5 text-[13px] last:border-none hover:bg-bakgrunn"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 font-medium text-blekk">
                            {s.harFunn && (
                              <span aria-hidden className="font-serif text-dom-rod">
                                §
                              </span>
                            )}
                            <span className="truncate">{s.tittel}</span>
                          </span>
                          {s.underTekst && (
                            <span
                              className={`mt-0.5 block text-[11.5px] ${
                                s.hastende ? "text-dom-rod" : "text-dempet"
                              }`}
                            >
                              {s.underTekst}
                            </span>
                          )}
                        </span>
                        {s.belop != null && (
                          <span className="shrink-0 tabular-nums font-semibold text-blekk">
                            {formaterBelop(s.belop)} kr
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtrerteEnkelt.length > 0 && (
        <div className="mt-6">
          <p className="eyebrow mb-2">Enkeltstående (1 krav)</p>
          <ul className="flex flex-col gap-2.5">
            {filtrerteEnkelt.map((sak) => (
              <li key={sak.id}>
                <Kravkort {...sak} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {ingenTreff && (
        <p className="mt-6 text-center text-[13px] text-dempet">
          Ingen treff på «{sok}».
        </p>
      )}
    </div>
  );
}
