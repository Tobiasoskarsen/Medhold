"use client";

// Dommen — signaturøyeblikket ved et gebyrfunn (designordre §2.1). Ren
// presentasjon av det lagrede gebyrsjekk-resultatet; ingen vurderingslogikk her.
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { Calculator, CalendarClock, ChevronDown, ChevronRight } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { DomFullskjerm } from "@/components/DomFullskjerm";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { formaterDato, formaterTallDato } from "@/lib/dato";
import { EASING, FJAER, VARIGHET } from "@/lib/bevegelse";
import { LOVBESTEMT_FRIST_DAGER } from "@/lib/gjeld";
import { kr, overLinjer, sumavvikTekst, totalOver } from "@/lib/gebyrfunn-visning";
import type { Sumavvik } from "@/lib/sumkontroll";

/**
 * Dom (full) — hvit flate, dom-rød ramme, stempel-etikett, differansen som
 * stort tall, forklaring, kilde og (når stadiet støtter utkast) CTA til
 * innsigelsen. Dekorativt §-tegn øverst til høyre (aria-hidden).
 */
export function Dom({
  resultat,
  utkastHref,
  className = "",
}: {
  resultat: GebyrsjekkResultat;
  utkastHref?: string;
  className?: string;
}) {
  const linjer = overLinjer(resultat);
  if (linjer.length === 0) return null;
  const total = totalOver(linjer);

  // Stempelet: én gang ved mount. Statisk animate → motion re-trigger ikke ved
  // re-render (Motion2 §4). Reduced motion → kun opasitet (MotionConfig).
  return (
    <m.div
      initial={{ scale: 1.04, rotate: -0.6, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={FJAER}
      className={`relative overflow-hidden rounded-[22px] border-[1.5px] border-dom-rod bg-flate p-[18px] ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1.5 -top-7 select-none text-[130px] font-bold leading-none text-dom-rod opacity-[0.07]"
      >
        §
      </span>

      <span className="relative inline-block rounded border border-dom-rod px-2 py-[3px] text-[11px] font-bold uppercase tracking-[0.14em] text-dom-rod">
        Gebyrsjekk · funn
      </span>

      <p className="relative mt-3 text-dom-rod">
        <span className="tall-xl">{kr(total)}</span>
        <span className="text-[20px] font-semibold"> kr over lovlig sats</span>
      </p>

      <p className="relative mt-2 text-[14px] leading-relaxed text-blekk">
        {linjer.map((l) => l.forklaring).join(" ")}
      </p>

      <p className="relative mt-2.5 text-[11.5px] text-dempet">
        Kontrollert mot offentlige maksimalsatser, gjeldende fra{" "}
        {formaterDato(resultat.satsGyldigFra)}.
      </p>

      {utkastHref && (
        <Primærknapp href={utkastHref} className="relative mt-3.5">
          Bruk funnet i innsigelsen
        </Primærknapp>
      )}
    </m.div>
  );
}

// Funnradene (redesign-ordren §2B): kompakte rader i én felles liste, så
// funnene ikke konkurrerer med neste handling. Utfyllende forklaring åpnes via
// tydelige detaljhandlinger. `historisk` (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2):
// funnet gjelder et brev som er mer enn 45 dager gammelt — da er det historikk,
// ikke en akutt fare, så rødt/oransje blir nøytralt. Bruk FunnListe rundt.

/** Den felles flaten rundt funnradene. */
export function FunnListe({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`divide-y divide-strek overflow-hidden rounded-kort border border-kant bg-flate ${className}`}
      style={{ boxShadow: "var(--kort-skygge)" }}
    >
      {children}
    </div>
  );
}

function FunnIkon({
  historisk,
  children,
}: {
  historisk: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`flex size-9 shrink-0 items-center justify-center rounded-liten text-[17px] font-bold ${
        historisk ? "bg-flate-2 text-dempet" : "bg-dom-rod-bg text-dom-rod"
      }`}
    >
      {children}
    </span>
  );
}

function FunnHode({
  etikett,
  tall,
  historiskFra,
}: {
  etikett: string;
  tall: string;
  /** Brevdatoen (ISO) når raden er historisk, ellers utelatt. */
  historiskFra?: string | null;
}) {
  const historisk = historiskFra !== undefined;
  return (
    <>
      <span className="radtekst block font-medium">
        {etikett}
        {historisk && historiskFra && ` · fra ${formaterTallDato(historiskFra)}`}
      </span>
      <span
        className={`mt-0.5 block text-[17px] font-bold tabular-nums leading-tight tracking-[-0.01em] ${
          historisk ? "text-dempet" : "text-dom-rod"
        }`}
      >
        {tall}
      </span>
    </>
  );
}

/**
 * DomMini — gebyrfunnet som rad. Hele raden er en knapp som åpner DomFullskjerm
 * (ren visuell tilstand, ingen ny rute). Fokus flyttes tilbake hit ved lukking.
 */
export function DomMini({
  resultat,
  utkastHref,
  historisk = false,
  brevdato = null,
  className = "",
}: {
  resultat: GebyrsjekkResultat;
  /** Videreført til DomFullskjerm sin «Bruk i svaret →»-CTA når stadiet støtter utkast. */
  utkastHref?: string;
  /** Brevet er mer enn 45 dager gammelt (erGammeltBrev) — dempet. */
  historisk?: boolean;
  /** Brevets dato, til « · fra {dato}» når raden er historisk. */
  brevdato?: string | null;
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  const knappRef = useRef<HTMLButtonElement>(null);
  const linjer = overLinjer(resultat);
  if (linjer.length === 0) return null;
  const total = totalOver(linjer);
  const forklaring =
    linjer.length === 1
      ? linjer[0].forklaring
      : `Gebyrsjekken fant ${linjer.length} beløp over maksimalsats.`;

  return (
    <>
      <button
        type="button"
        ref={knappRef}
        onClick={() => setÅpen(true)}
        aria-label={`Gebyrsjekk: ${kr(total)} kr over maksimalsats. Se detaljer`}
        className={`trykk flex w-full items-start gap-3 p-4 text-left ${className}`}
      >
        <FunnIkon historisk={historisk}>§</FunnIkon>
        <span className="min-w-0 flex-1">
          <FunnHode
            etikett="Gebyrsjekk"
            tall={`${kr(total)} kr over maksimalsats`}
            historiskFra={historisk ? brevdato : undefined}
          />
          <span className="mt-1 block text-hjelp leading-[1.4] text-blekk">
            {forklaring}
          </span>
          <span className="mt-1 block text-meta text-dempet">
            Kontrollert mot inkassoforskriften · satser fra{" "}
            {formaterDato(resultat.satsGyldigFra)}
          </span>
        </span>
        <ChevronRight className="mt-2.5 size-4 shrink-0 text-dempet" aria-hidden />
      </button>
      {åpen && (
        <DomFullskjerm
          resultat={resultat}
          utkastHref={utkastHref}
          onLukk={() => {
            setÅpen(false);
            knappRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

/** Hele dager mellom to rene datoer (YYYY-MM-DD). */
function dagerMellom(fra: string, til: string): number {
  return Math.round(
    (Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * DomMiniFrist — fristfunnet som rad (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §A.3).
 * `differanseDager` skal være et POSITIVT tall (antall dager kortere — bruk
 * Math.abs på FristSammenligning sin negative differanse). Forbeholdet «Kravet
 * blir ikke ugyldig av det» står alltid synlig
 * (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.1); resten åpnes med «Hva betyr dette?».
 */
export function DomMiniFrist({
  differanseDager,
  brevdato,
  beregnetDato,
  historisk = false,
  className = "",
}: {
  differanseDager: number;
  /** Brevets dato (ISO). Null → fristen brevet ga regnes fra lovens 14 dager. */
  brevdato: string | null;
  /** Den lovlige fristen (FristSammenligning.beregnetDato). */
  beregnetDato: string;
  historisk?: boolean;
  className?: string;
}) {
  const [åpen, setÅpen] = useState(false);
  // Dagene brevet ga = dager fra brevdato til lovens frist, minus det brevet
  // kortet ned med. Beregnet frist er alltid brevdato + 14 (beregnFrist).
  const lovensDager = brevdato
    ? dagerMellom(brevdato, beregnetDato)
    : LOVBESTEMT_FRIST_DAGER;
  const gitt = lovensDager - differanseDager;
  return (
    <div className={`flex items-start gap-3 p-4 ${className}`}>
      <FunnIkon historisk={historisk}>
        <CalendarClock className="size-[18px]" strokeWidth={2} />
      </FunnIkon>
      <div className="min-w-0 flex-1">
        <FunnHode
          etikett="Fristsjekk"
          tall={`${differanseDager} dager for kort`}
          historiskFra={historisk ? brevdato : undefined}
        />
        <p className="mt-1 text-hjelp leading-[1.4] text-blekk">
          Brevet ga deg {gitt} dager. Loven krever minst{" "}
          {LOVBESTEMT_FRIST_DAGER}. Kravet blir ikke ugyldig av det.
        </p>
        <AnimatePresence initial={false}>
          {åpen && (
            <m.p
              key="mer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: VARIGHET.rolig, ease: EASING }}
              style={{ overflow: "hidden" }}
              className="text-hjelp leading-[1.4] text-blekk"
            >
              <span className="block pt-1">
                Kreditor kunne tidligst gå videre {formaterDato(beregnetDato)}. Har
                de lagt til kostnader før det, kan du be om at de fjernes.
              </span>
            </m.p>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={() => setÅpen((o) => !o)}
          aria-expanded={åpen}
          className="trykk -my-2 mt-0 flex min-h-11 items-center gap-1 text-hjelp font-medium text-dempet transition hover:text-blekk"
        >
          {åpen ? "Skjul" : "Hva betyr dette?"}
          <ChevronDown
            className={`size-[15px] transition-transform duration-200 ${åpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
    </div>
  );
}

/**
 * DomMiniSum — beløpskontrollen som rad (Del B.2). Brevet krever mer enn
 * hovedstol og kostnader blir, og differansen er ikke forklart. Samme ramme
 * som DomMiniFrist, ikke klikkbar. Teksten er kodegenerert fra lagrede tall.
 */
export function DomMiniSum({
  avvik,
  historisk = false,
  brevdato = null,
  className = "",
}: {
  avvik: Sumavvik;
  historisk?: boolean;
  brevdato?: string | null;
  className?: string;
}) {
  const t = sumavvikTekst(avvik);
  return (
    <div className={`flex items-start gap-3 p-4 ${className}`}>
      <FunnIkon historisk={historisk}>
        <Calculator className="size-[18px]" strokeWidth={2} />
      </FunnIkon>
      <div className="min-w-0 flex-1">
        <FunnHode
          etikett={t.etikett}
          tall={t.tall}
          historiskFra={historisk ? brevdato : undefined}
        />
        <p className="mt-1 text-hjelp leading-[1.4] text-blekk">{t.tekst}</p>
      </div>
    </div>
  );
}
