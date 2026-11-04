"use client";

// Dommen — signaturøyeblikket ved et gebyrfunn (designordre §2.1). Ren
// presentasjon av det lagrede gebyrsjekk-resultatet; ingen vurderingslogikk her.
import { useRef, useState, type ReactNode } from "react";
import { m } from "motion/react";
import { Primærknapp } from "@/components/ui";
import { DomFullskjerm } from "@/components/DomFullskjerm";
import type { GebyrsjekkResultat } from "@/lib/gebyr";
import { formaterDato, formaterTallDato } from "@/lib/dato";
import { FJAER } from "@/lib/bevegelse";
import { LOVBESTEMT_FRIST_DAGER } from "@/lib/gjeld";
import { kr, overLinjer, totalOver } from "@/lib/gebyrfunn-visning";

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

// Felles ramme for DomMini/DomMiniFrist (Retning B §7.1). `historisk`
// (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.2): funnet gjelder et brev som er mer enn
// 45 dager gammelt — da er det historikk, ikke en akutt fare, og kortet blir
// en rolig flate i stedet for rødt.
const FUNNKORT =
  "block w-full rounded-[22px] bg-dom-rod-bg p-[18px] text-left mork:border mork:border-dom-rod/20";
const FUNNKORT_HISTORISK =
  "block w-full rounded-[22px] border border-strek bg-flate p-[18px] text-left";

function Funninnhold({
  etikett,
  tall,
  historiskFra,
  children,
}: {
  etikett: string;
  tall: string;
  /** Brevdatoen (ISO) når kortet er historisk, ellers utelatt. */
  historiskFra?: string | null;
  children: ReactNode;
}) {
  const historisk = historiskFra !== undefined;
  const farge = historisk ? "text-dempet" : "text-dom-rod";
  return (
    <>
      <span className={`block text-[12px] font-bold uppercase tracking-[0.08em] ${farge}`}>
        {etikett}
        {historisk && historiskFra && (
          <span className="normal-case tracking-normal">
            {" "}
            · fra {formaterTallDato(historiskFra)}
          </span>
        )}
      </span>
      <span className={`tall-m mt-2 block ${farge}`}>{tall}</span>
      {children}
    </>
  );
}

/**
 * DomMini — funnkortet på krav-detalj. Klikkbar: åpner DomFullskjerm som en
 * fullskjerm-avsløring — ren visuell tilstand, ingen ny rute/navigasjon.
 * Fokus flyttes tilbake hit ved lukking.
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
  /** Brevet er mer enn 45 dager gammelt (erGammeltBrev) — dempet flate. */
  historisk?: boolean;
  /** Brevets dato, til « · fra {dato}» når kortet er historisk. */
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
        aria-label="Se gebyrfunnet i fullskjerm"
        className={`trykk ${historisk ? FUNNKORT_HISTORISK : FUNNKORT} ${className}`}
      >
        <Funninnhold
          etikett="Gebyrsjekk"
          tall={`${kr(total)} kr for mye`}
          historiskFra={historisk ? brevdato : undefined}
        >
          <span className="mt-2 block text-[13.5px] leading-[1.45] text-blekk">
            {forklaring} Funnet er lagt klart til svaret ditt.
          </span>
          <span className="mt-2 block text-[11.5px] text-dempet">
            Kontrollert mot inkassoforskriften · satser fra{" "}
            {formaterDato(resultat.satsGyldigFra)}
          </span>
          <span
            className={`mt-3 block text-[13px] font-semibold ${
              historisk ? "text-blekk" : "text-dom-rod"
            }`}
          >
            Se detaljer →
          </span>
        </Funninnhold>
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
 * DomMiniFrist — samme ramme som DomMini, for et fristfunn
 * (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §A.3), men ikke klikkbar.
 * `differanseDager` skal være et POSITIVT tall (antall dager kortere — bruk
 * Math.abs på FristSammenligning sin negative differanse). Teksten sier hva
 * funnet betyr (MEDHOLD_SIKKERHET_ARBEIDSORDRE §C.1): kravet blir ikke
 * ugyldig, men kreditor kunne tidligst gå videre på den lovlige datoen.
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
  // Dagene brevet ga = dager fra brevdato til lovens frist, minus det brevet
  // kortet ned med. Beregnet frist er alltid brevdato + 14 (beregnFrist).
  const lovensDager = brevdato
    ? dagerMellom(brevdato, beregnetDato)
    : LOVBESTEMT_FRIST_DAGER;
  const gitt = lovensDager - differanseDager;
  return (
    <div className={`${historisk ? FUNNKORT_HISTORISK : FUNNKORT} ${className}`}>
      <Funninnhold
        etikett="Fristsjekk"
        tall={`${differanseDager} dager for kort`}
        historiskFra={historisk ? brevdato : undefined}
      >
        <p className="mt-2 text-[13.5px] leading-[1.45] text-blekk">
          Brevet ga deg {gitt} dager. Loven krever minst{" "}
          {LOVBESTEMT_FRIST_DAGER}. Kravet blir ikke ugyldig av det, men
          kreditor kunne tidligst gå videre {formaterDato(beregnetDato)}. Har de
          lagt til kostnader før det, kan du be om at de fjernes.
        </p>
      </Funninnhold>
    </div>
  );
}
