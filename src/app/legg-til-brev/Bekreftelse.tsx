"use client";

// Bekreftelseskortet øverst i steg 3 (MEDHOLD_SIKKERHET_ARBEIDSORDRE §A.2).
// Brukeren sammenligner tallene AI-en leste med brevet, retter det som er
// feil, og bekrefter. Funnene (gebyrsjekk, frist, veivalg) vises først etter
// bekreftelsen, så ingen låser seg på et funn som bygger på feil tall.
// All vurdering (sumkontrollen) skjer i lib/sumkontroll.ts — her vises den.
import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Kort } from "@/components/ui";
import {
  KOSTNADSTYPER,
  KOSTNADSTYPE_ETIKETT,
  type Kostnadslinje,
  type Kostnadstype,
} from "@/lib/gebyr";
import type { Sumkontroll } from "@/lib/sumkontroll";
import { formaterDato } from "@/lib/dato";
import { tolkKr } from "@/lib/format";
import { kr } from "@/lib/gebyrfunn-visning";

const FELT =
  "w-full rounded-[14px] border border-strek bg-flate px-3 py-2 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

function krTekst(s: string): string {
  const n = tolkKr(s);
  return n === null ? "Mangler" : `${kr(n)} kr`;
}

/**
 * Én rad: etikett til venstre, verdi til høyre med blyant. Trykk gjør verdien
 * om til et felt; blur eller Enter avslutter redigeringen.
 */
function Rad({
  etikett,
  verdi,
  felt,
  etter,
}: {
  etikett: ReactNode;
  verdi: string;
  felt: (ferdig: () => void) => ReactNode;
  etter?: ReactNode;
}) {
  const [redigerer, setRedigerer] = useState(false);
  return (
    <li className="border-t-[0.5px] border-strek py-2.5 first:border-t-0">
      {redigerer ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-dempet">{etikett}</span>
          {felt(() => setRedigerer(false))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRedigerer(true)}
          className="trykk flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-[13px] text-dempet">{etikett}</span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-blekk">{verdi}</span>
            <Pencil className="size-3.5 shrink-0 text-dempet" aria-hidden />
            <span className="sr-only">Rett</span>
          </span>
        </button>
      )}
      {etter}
    </li>
  );
}

function avsluttVedEnter(ferdig: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ferdig();
    }
  };
}

/** Beløpsfelt som tolkes ved blur — et ugyldig beløp beholder det gamle. */
function LinjeFelt({
  linje,
  onEndre,
  ferdig,
}: {
  linje: Kostnadslinje;
  onEndre: (l: Kostnadslinje) => void;
  ferdig: () => void;
}) {
  const [utkast, setUtkast] = useState(String(linje.belop).replace(".", ","));
  const lagre = () => {
    const n = tolkKr(utkast);
    if (n !== null && n !== linje.belop) onEndre({ ...linje, belop: n });
  };
  return (
    <div
      className="flex gap-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          lagre();
          ferdig();
        }
      }}
    >
      <select
        value={linje.type}
        onChange={(e) => onEndre({ ...linje, type: e.target.value as Kostnadstype })}
        className={`${FELT} min-w-0 flex-1`}
        aria-label="Type kostnad"
      >
        {KOSTNADSTYPER.map((t) => (
          <option key={t} value={t}>
            {KOSTNADSTYPE_ETIKETT[t]}
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={utkast}
        onChange={(e) => setUtkast(e.target.value)}
        onKeyDown={avsluttVedEnter(() => {
          lagre();
          ferdig();
        })}
        className={`${FELT} w-28`}
        aria-label="Beløp i kroner"
      />
    </div>
  );
}

export function Bekreftelse({
  brevdato,
  onBrevdato,
  belop,
  onBelop,
  hovedstolTekst,
  onHovedstol,
  linjer,
  onLinjer,
  fristIBrevet,
  onFristIBrevet,
  sumkontroll,
  bekreftet,
  onBekreftet,
  stemmerLikevel,
  onStemmerLikevel,
}: {
  brevdato: string;
  onBrevdato: (v: string) => void;
  belop: string;
  onBelop: (v: string) => void;
  hovedstolTekst: string;
  onHovedstol: (v: string) => void;
  linjer: Kostnadslinje[];
  onLinjer: (l: Kostnadslinje[]) => void;
  fristIBrevet: string;
  onFristIBrevet: (v: string) => void;
  sumkontroll: Sumkontroll;
  bekreftet: boolean;
  onBekreftet: (v: boolean) => void;
  stemmerLikevel: boolean;
  onStemmerLikevel: (v: boolean) => void;
}) {
  return (
    <Kort className="mt-5">
      <h2 className="seksjonstittel text-blekk">Stemmer dette med brevet?</h2>
      <p className="mt-1 text-[13px] text-dempet">
        Sammenlign med brevet. Retter du noe her, regner vi alt på nytt.
      </p>

      <ul className="mt-3">
        <Rad
          etikett="Brevdato"
          verdi={brevdato ? formaterDato(brevdato) : "Mangler"}
          felt={(ferdig) => (
            <input
              type="date"
              autoFocus
              value={brevdato}
              onChange={(e) => onBrevdato(e.target.value)}
              onBlur={ferdig}
              onKeyDown={avsluttVedEnter(ferdig)}
              className={FELT}
            />
          )}
        />
        <Rad
          etikett="Å betale"
          verdi={krTekst(belop)}
          felt={(ferdig) => (
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={belop}
              onChange={(e) => onBelop(e.target.value)}
              onBlur={ferdig}
              onKeyDown={avsluttVedEnter(ferdig)}
              placeholder="F.eks. 1288"
              className={FELT}
            />
          )}
        />
        <Rad
          etikett="Hovedstol"
          verdi={krTekst(hovedstolTekst)}
          felt={(ferdig) => (
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={hovedstolTekst}
              onChange={(e) => onHovedstol(e.target.value)}
              onBlur={ferdig}
              onKeyDown={avsluttVedEnter(ferdig)}
              placeholder="Selve gjelden, før gebyrer"
              className={FELT}
            />
          )}
        />
        {linjer.map((l, i) => (
          <Rad
            // Indeksen er nøkkelen: linjene har ingen id, og rekkefølgen
            // endres bare ved «Fjern» (da tegnes radene på nytt uansett).
            key={`${i}-${linjer.length}`}
            etikett={KOSTNADSTYPE_ETIKETT[l.type]}
            verdi={`${kr(l.belop)} kr`}
            felt={(ferdig) => (
              <LinjeFelt
                linje={l}
                ferdig={ferdig}
                onEndre={(ny) => onLinjer(linjer.map((x, j) => (j === i ? ny : x)))}
              />
            )}
            etter={
              <button
                type="button"
                onClick={() => onLinjer(linjer.filter((_, j) => j !== i))}
                className="mt-1 text-[12px] text-dempet underline decoration-strek underline-offset-2 transition hover:text-blekk"
              >
                Fjern
              </button>
            }
          />
        ))}
        <li className="py-2">
          <button
            type="button"
            onClick={() =>
              onLinjer([...linjer, { type: "annet", belop: 0, tekst: "" }])
            }
            className="text-[13px] font-medium text-aksent transition hover:text-blekk"
          >
            + Legg til gebyr
          </button>
        </li>
        <Rad
          etikett="Frist i brevet"
          verdi={fristIBrevet ? formaterDato(fristIBrevet) : "Ingen"}
          felt={(ferdig) => (
            <input
              type="date"
              autoFocus
              value={fristIBrevet}
              onChange={(e) => onFristIBrevet(e.target.value)}
              onBlur={ferdig}
              onKeyDown={avsluttVedEnter(ferdig)}
              className={FELT}
            />
          )}
        />
      </ul>

      {sumkontroll.status === "stemmer" && (
        <p className="mt-2 text-[13px] text-dempet">
          Hovedstol og gebyrer blir {kr(sumkontroll.sum)} kr. Det stemmer med
          totalen.
        </p>
      )}
      {sumkontroll.status === "avvik" && (
        <div className="mt-2 rounded-[14px] bg-dom-rod-bg p-3 text-[13px] text-blekk">
          <p>
            Tallene går ikke opp. Hovedstol og gebyrer blir{" "}
            {kr(sumkontroll.sum)} kr, men brevet sier {kr(sumkontroll.total)} kr.
            Sjekk beløpene mot brevet.
          </p>
          <label className="mt-2.5 flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={stemmerLikevel}
              onChange={(e) => onStemmerLikevel(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-aksent"
            />
            Det stemmer likevel (for eksempel delbetaling eller renter som ikke
            står oppført)
          </label>
        </div>
      )}

      <label className="mt-4 flex items-center gap-2.5 border-t-[0.5px] border-strek pt-3.5 text-sm font-medium text-blekk">
        <input
          type="checkbox"
          checked={bekreftet}
          onChange={(e) => onBekreftet(e.target.checked)}
          className="size-4 shrink-0 accent-aksent"
        />
        Ja, dette stemmer med brevet
      </label>
    </Kort>
  );
}
