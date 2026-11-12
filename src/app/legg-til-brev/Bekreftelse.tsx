"use client";

// Bekreftelseskortet øverst i steg 3 (MEDHOLD_SIKKERHET_ARBEIDSORDRE §A.2).
// Brukeren sammenligner tallene AI-en leste med brevet, retter det som er
// feil, og bekrefter. Funnene (gebyrsjekk, frist, veivalg) vises først etter
// bekreftelsen, så ingen låser seg på et funn som bygger på feil tall.
// All vurdering (sumkontrollen) skjer i lib/sumkontroll.ts — her vises den.
import { useState, type ReactNode } from "react";
import { Avkrysning } from "@/components/ui/Avkrysning";
import { AnimatePresence, m } from "motion/react";
import { Pencil } from "lucide-react";
import { VARIGHET, EASING } from "@/lib/bevegelse";
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
import { tolkSats } from "@/lib/rente";
import { kr } from "@/lib/gebyrfunn-visning";

const FELT =
  "w-full min-h-11 scroll-mt-28 rounded-kontroll border border-strek bg-flate px-3 py-2 text-base text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

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
  fremhevet = false,
}: {
  etikett: ReactNode;
  verdi: string;
  felt: (ferdig: () => void) => ReactNode;
  etter?: ReactNode;
  fremhevet?: boolean;
}) {
  const [redigerer, setRedigerer] = useState(false);
  return (
    <li className="border-t-[0.5px] border-strek py-1 first:border-t-0">
      {/* Verdi ↔ felt glir kort over i hverandre, så rettingen føles som
          samme rad som åpner seg, ikke et hopp. */}
      <AnimatePresence mode="wait" initial={false}>
        {redigerer ? (
          <m.div
            key="felt"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: VARIGHET.hurtig, ease: EASING }}
            className="flex flex-col gap-1.5"
          >
            <span className="text-hjelp text-dempet">{etikett}</span>
            {felt(() => setRedigerer(false))}
          </m.div>
        ) : (
          <m.button
            key="verdi"
            type="button"
            onClick={() => setRedigerer(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: VARIGHET.hurtig, ease: EASING }}
            className="trykk group flex min-h-11 w-full items-center justify-between gap-3 rounded-liten text-left focus-visible:outline-2 focus-visible:outline-aksent"
          >
            <span className="text-hjelp text-dempet">{etikett}</span>
            <span className="flex min-w-0 items-center gap-2 text-right">
              {/* Ny verdi (etter retting) fader inn — et lite «oppdatert». */}
              <m.span
                key={verdi}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration: VARIGHET.rolig, ease: EASING }}
                className={`${fremhevet ? "tall-s" : "text-sm font-semibold"} min-w-0 break-words tabular-nums text-blekk`}
              >
                {verdi}
              </m.span>
              <Pencil
                className="size-3.5 shrink-0 text-dempet transition-colors group-hover:text-blekk"
                aria-hidden
              />
              <span className="sr-only">Rett</span>
            </span>
          </m.button>
        )}
      </AnimatePresence>
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

/**
 * Ekstra rad for rentelinjer: fra-dato, til-dato og sats. Brukeren retter det
 * AI-en leste (eller fyller inn det den ikke fant), og det som står her
 * overstyrer. Tomt felt betyr «ukjent»: renten blir ikke vurdert. Ingen gjetting.
 */
function RenteFelt({
  linje,
  onEndre,
}: {
  linje: Kostnadslinje;
  onEndre: (l: Kostnadslinje) => void;
}) {
  const [sats, setSats] = useState(linje.rentesats !== undefined ? String(linje.rentesats).replace(".", ",") : "");
  const sett = (felt: "renteFra" | "renteTil", v: string) => {
    const { [felt]: _fjernet, ...rest } = linje;
    void _fjernet;
    onEndre(v ? { ...rest, [felt]: v } : rest);
  };
  const lagreSats = () => {
    const { rentesats: _fjernet, ...rest } = linje;
    void _fjernet;
    const n = tolkSats(sats);
    onEndre(n !== null ? { ...rest, rentesats: n } : rest);
    if (n === null) setSats("");
  };
  const felt = `${FELT} text-sm`;
  return (
    <div className="mb-2 grid grid-cols-2 gap-2 pt-1" role="group" aria-label="Renteperiode og sats">
      <label className="block text-meta text-dempet">
        Fra dato
        <input type="date" value={linje.renteFra ?? ""} onChange={(e) => sett("renteFra", e.target.value)} className={`${felt} mt-1`} />
      </label>
      <label className="block text-meta text-dempet">
        Til dato
        <input type="date" value={linje.renteTil ?? ""} onChange={(e) => sett("renteTil", e.target.value)} className={`${felt} mt-1`} />
      </label>
      <label className="col-span-2 block text-meta text-dempet">
        Sats i brevet (prosent per år, valgfritt)
        <input
          type="text"
          inputMode="decimal"
          value={sats}
          onChange={(e) => setSats(e.target.value)}
          onBlur={lagreSats}
          onKeyDown={avsluttVedEnter(lagreSats)}
          placeholder="F.eks. 12,25"
          className={`${felt} mt-1`}
        />
      </label>
    </div>
  );
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
    <Kort>
      <ul aria-label="Tall og datoer fra brevet">
        <Rad
          etikett="Brevdato"
          verdi={brevdato ? formaterDato(brevdato) : "Mangler"}
          felt={(ferdig) => (
            <input
              type="date"
              aria-label="Brevdato"
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
          fremhevet
          verdi={krTekst(belop)}
          felt={(ferdig) => (
            <input
              type="text"
              inputMode="decimal"
              aria-label="Å betale i kroner"
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
              aria-label="Hovedstol i kroner"
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
              <>
                {l.type === "forsinkelsesrente" && (
                  <RenteFelt linje={l} onEndre={(ny) => onLinjer(linjer.map((x, j) => (j === i ? ny : x)))} />
                )}
                <button
                  type="button"
                  onClick={() => onLinjer(linjer.filter((_, j) => j !== i))}
                  className="mt-1 text-meta text-dempet underline decoration-strek underline-offset-2 transition hover:text-blekk"
                >
                  Fjern
                </button>
              </>
            }
          />
        ))}
        <li className="py-2">
          <button
            type="button"
            onClick={() =>
              onLinjer([...linjer, { type: "annet", belop: 0, tekst: "" }])
            }
            className="text-hjelp font-medium text-aksent transition hover:text-blekk"
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
              aria-label="Frist i brevet"
              onChange={(e) => onFristIBrevet(e.target.value)}
              onBlur={ferdig}
              onKeyDown={avsluttVedEnter(ferdig)}
              className={FELT}
            />
          )}
        />
      </ul>

      {sumkontroll.status === "stemmer" && (
        <p className="mt-2 text-hjelp text-dempet">
          Hovedstol og gebyrer blir {kr(sumkontroll.sum)} kr. Det stemmer med
          totalen.
        </p>
      )}
      {sumkontroll.status === "avvik" && (
        <div className="mt-2 rounded-kontroll bg-dom-rod-bg p-3 text-hjelp text-blekk">
          <p>
            Tallene går ikke opp. Hovedstol og gebyrer blir{" "}
            {kr(sumkontroll.sum)} kr, men brevet sier {kr(sumkontroll.total)} kr.
            Sjekk beløpene mot brevet.
          </p>
          <label className="mt-2.5 flex items-start gap-2.5">
            <Avkrysning
              checked={stemmerLikevel}
              onChange={onStemmerLikevel}
              className="mt-0.5"
            />
            Det stemmer likevel (for eksempel delbetaling eller renter som ikke
            står oppført)
          </label>
        </div>
      )}

      <label className="mt-4 flex items-center gap-2.5 border-t-[0.5px] border-strek pt-3.5 text-sm font-medium text-blekk">
        <Avkrysning
          checked={bekreftet}
          onChange={onBekreftet}
        />
        Ja, dette stemmer med brevet
      </label>
    </Kort>
  );
}
