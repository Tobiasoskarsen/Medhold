"use client";

import { useRef, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { useInntreden, useSekvensForsinkelse } from "@/components/ui";
import {
  STATUS_ETIKETT,
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
 * Én rad i kravlisten (Retning B §6 — rad, ikke kort). Ved trykk settes `view-transition-name` på nettopp
 * dette kortets navn/beløp (så KUN de morfer til krav-detaljens header, ikke
 * alle kortene), et flagg som forteller detaljens beløp at det kom via en delt
 * overgang (skal ikke telle opp), og navigasjonen kjøres inne i en
 * View-Transition (Motion2 §1) — uendret fra før (Sakslisteordre guardrail 2).
 *
 * `delNavn`: navnet deler view-transition-name med krav-detaljens H1 KUN når
 * tekstene er garantert like (ingen opprinnelig_kreditor) — ellers ville
 * teksten «hoppe» til noe annet midt i overgangen.
 *
 * `status === "fullfort"` → avsluttet-variant: dempet beløp (teksten skal
 * fortsatt være lett å lese), og utfallspillen erstatter underteksten (frist/venter/stadium). Ingen
 * funn-markør på avsluttede (Sakslisteordre §2.3).
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
  harHovedstolAvvik = false,
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
  /** Hovedstolen har endret seg mellom to brev i saken (MEDHOLD_HOVEDSTOL_
   *  KONSISTENS_ARBEIDSORDRE §3.2) — distinkt varseltrekant, ikke § (som er
   *  forbeholdt gebyrfunn), slik at de to ikke forveksles på et lite kort. */
  harHovedstolAvvik?: boolean;
  /** Kun lokal søking i data som allerede er hentet for brukeren. */
  saksnummer?: string | null;
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
  // Underteksten (Retning B §5.3) — første regel som treffer.
  const [undertekst, hastende] =
    status === "venter_pa_svar"
      ? // Gruppen heter allerede «Venter på svar»: vis stadiet i stedet.
        [
          stadiumEtikett
            ? stadiumEtikett.charAt(0).toUpperCase() + stadiumEtikett.slice(1)
            : STATUS_ETIKETT.venter_pa_svar,
          false,
        ]
      : dagerIgjen != null
        ? [fristChipTekst(dagerIgjen), erHastende(dagerIgjen)]
        : [
            stadiumEtikett
              ? stadiumEtikett.charAt(0).toUpperCase() + stadiumEtikett.slice(1)
              : null,
            false,
          ];

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
      className="trykk flex min-h-[64px] items-center gap-3 py-3"
      style={{
        opacity: aktiv ? PENDING_OPASITET : undefined,
        transitionProperty: "opacity",
        transitionDuration: "var(--bevegelse-hurtig)",
        transitionTimingFunction: "var(--bevegelse-easing)",
      }}
    >
      <span className="min-w-0 flex-1">
        <span
          ref={navnRef}
          className="radtittel line-clamp-2 text-blekk"
        >
          {navn}
        </span>
        {avsluttet && utfall ? (
          <m.span
            {...merkeInntreden}
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${UTFALL_STIL[utfall]}`}
          >
            {UTFALL_ETIKETT[utfall]}
          </m.span>
        ) : (
          undertekst && (
            <m.span
              {...merkeInntreden}
              className={`radtekst block ${
                hastende ? "font-semibold !text-dom-rod" : ""
              }`}
            >
              {undertekst}
            </m.span>
          )
        )}
        {/* Markørene med ord, ikke bare symbol: de forklarer seg selv. */}
        {!avsluttet && (harFunn || harHovedstolAvvik) && (
          <m.span
            {...merkeInntreden}
            className="mt-0.5 flex flex-wrap gap-x-2 text-meta font-semibold text-dom-rod"
          >
            {harFunn && <span>§ Gebyrfunn</span>}
            {harHovedstolAvvik && (
              <span className="inline-flex items-center gap-1">
                <TriangleAlert className="size-3" aria-hidden strokeWidth={2.25} />
                Hovedstol endret
              </span>
            )}
          </m.span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {belop && (
          <span
            ref={belopRef}
            className={`text-brod font-bold tabular-nums ${avsluttet ? "text-dempet" : "text-blekk"}`}
          >
            {belop} kr
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-dempet" aria-hidden />
      </span>
    </a>
  );
}
