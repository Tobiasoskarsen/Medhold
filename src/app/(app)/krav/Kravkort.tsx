"use client";

import { useRef, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { Kort, useInntreden, useSekvensForsinkelse } from "@/components/ui";
import {
  STATUS_ETIKETT,
  STATUS_STIL,
  UTFALL_ETIKETT,
  UTFALL_STIL,
  type SakStatus,
  type SakUtfall,
} from "@/lib/types";
import {
  DELT_OVERGANG_NOKKEL,
  ORKESTER_STIGRING,
  PENDING_OPASITET,
  VARIGHET,
} from "@/lib/bevegelse";
import { useViewOvergang } from "@/components/ViewOvergang";
import { useTrykkFeedback } from "@/lib/useTrykkFeedback";
import { dagerTil } from "@/lib/dato";
import { erHastende, fristChipTekst } from "@/lib/frist";

/**
 * Ett kort i kravlisten. Ved trykk settes `view-transition-name` på nettopp
 * dette kortets navn/beløp (så KUN de morfer til krav-detaljens header, ikke
 * alle kortene), et flagg som forteller detaljens beløp at det kom via en delt
 * overgang (skal ikke telle opp), og navigasjonen kjøres inne i en
 * View-Transition (Motion2 §1) — uendret fra før (Sakslisteordre guardrail 2).
 *
 * `delNavn`: navnet deler view-transition-name med krav-detaljens H1 KUN når
 * tekstene er garantert like (ingen opprinnelig_kreditor) — ellers ville
 * teksten «hoppe» til noe annet midt i overgangen.
 *
 * `status === "fullfort"` → avsluttet-variant: dempet flate (opacity-70),
 * ingen hover-heving, utfallspill i stedet for venter_pa_svar-pill/nedtellings-
 * chip/funn-markør (Sakslisteordre §2.3).
 */
export function Kravkort({
  id,
  navn,
  delNavn,
  belop,
  stadiumEtikett,
  frist,
  status,
  utfall,
  harFunn,
}: {
  id: string;
  navn: string;
  delNavn: boolean;
  belop: string | null;
  stadiumEtikett: string | null;
  frist: string | null;
  status: SakStatus;
  utfall: SakUtfall | null;
  harFunn: boolean;
}) {
  const router = useRouter();
  const { start } = useViewOvergang();
  const { aktiv, start: startTrykk } = useTrykkFeedback();
  const navnRef = useRef<HTMLSpanElement>(null);
  const belopRef = useRef<HTMLSpanElement>(null);
  const href = `/krav/${id}`;
  const avsluttet = status === "fullfort";

  function klikk(e: MouseEvent<HTMLAnchorElement>) {
    // La modifiserte klikk (ny fane osv.) gå som vanlig.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
      return;
    e.preventDefault();

    // Navngi de delte elementene FØR overgangen tar gammel-snapshot.
    if (delNavn && navnRef.current)
      navnRef.current.style.viewTransitionName = `sak-navn-${id}`;
    if (belopRef.current)
      belopRef.current.style.viewTransitionName = `sak-belop-${id}`;

    try {
      sessionStorage.setItem(DELT_OVERGANG_NOKKEL, "1");
    } catch {
      /* privat modus e.l. — ignorer */
    }

    start(() => router.push(href));
  }

  const dagerIgjen = !avsluttet && frist ? dagerTil(frist) : null;
  const chipRod = dagerIgjen != null && erHastende(dagerIgjen);
  const visUnderlinje = !!stadiumEtikett || dagerIgjen != null;

  // Frist-chip/status-piller/§-markør lander et blunk etter kortet sitt eget
  // (SekvensDel) — kjedet via useSekvensForsinkelse, 0 utenfor en Sekvens
  // (Motion3 §2.3).
  const kjedet = useSekvensForsinkelse();
  const merkeInntreden = useInntreden(
    kjedet + ORKESTER_STIGRING,
    VARIGHET.hurtig,
  );

  return (
    <a
      href={href}
      onClick={klikk}
      onPointerDown={startTrykk}
      className="block"
      style={{
        opacity: aktiv ? PENDING_OPASITET : 1,
        transitionProperty: "opacity",
        transitionDuration: "var(--bevegelse-hurtig)",
        transitionTimingFunction: "var(--bevegelse-easing)",
      }}
    >
      <Kort
        klikkbar
        className={avsluttet ? "opacity-70" : "hover:border-dempet/40"}
      >
        <div className="flex items-start justify-between gap-3">
          <span ref={navnRef} className="text-sm font-medium text-blekk">
            {navn}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {harFunn && !avsluttet && (
              <m.span
                {...merkeInntreden}
                role="img"
                aria-label="Gebyrfunn i denne saken"
                className="font-serif text-[13px] font-semibold leading-none text-dom-rod"
              >
                §
              </m.span>
            )}
            {belop && (
              <span
                ref={belopRef}
                className={`text-sm font-medium ${avsluttet ? "text-dempet" : "text-blekk"}`}
              >
                {belop} kr
              </span>
            )}
          </span>
        </div>
        {visUnderlinje && (
          <div className="mt-1 flex items-center justify-between gap-2">
            {stadiumEtikett && (
              <p className="text-xs text-dempet">{stadiumEtikett}</p>
            )}
            {dagerIgjen != null && (
              <m.span
                {...merkeInntreden}
                className={`shrink-0 text-[11px] font-medium ${
                  chipRod ? "text-dom-rod" : "text-dempet"
                }`}
              >
                {fristChipTekst(dagerIgjen)}
              </m.span>
            )}
          </div>
        )}
        {!avsluttet && status === "venter_pa_svar" && (
          <m.span
            {...merkeInntreden}
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STIL.venter_pa_svar}`}
          >
            {STATUS_ETIKETT.venter_pa_svar}
          </m.span>
        )}
        {avsluttet && utfall && (
          <m.span
            {...merkeInntreden}
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${UTFALL_STIL[utfall]}`}
          >
            {UTFALL_ETIKETT[utfall]}
          </m.span>
        )}
      </Kort>
    </a>
  );
}
