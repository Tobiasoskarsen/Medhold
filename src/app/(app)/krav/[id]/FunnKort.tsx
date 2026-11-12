"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { DomFullskjerm } from "@/components/DomFullskjerm";
import { Primærknapp } from "@/components/ui/Primaerknapp";
import { KOSTNADSTYPE_ETIKETT, type GebyrsjekkResultat } from "@/lib/gebyr";
import { kr, overLinjer } from "@/lib/gebyrfunn-visning";
import { formaterTallDato } from "@/lib/dato";

const MAKS_LINJER = 3;

/**
 * Funnkortet øverst i oversikten (R8): ett hvitt kort for alt appen har funnet
 * i det nyeste brevet. Gebyrfunnet får overskrift og tall; beløpskontrollen,
 * fristfunnet og hovedstolavviket står som egne rader i samme kort og skjules
 * aldri (children). All tekst er kodegenerert fra lagrede felt.
 *
 * Trykk på gebyrdelen åpner utregning og kilder (DomFullskjerm) som før.
 */
export function FunnKort({
  gebyrsjekk,
  utkastHref,
  betalHref,
  visKnapper,
  historisk = false,
  brevdato = null,
  children,
}: {
  /** Lagret gebyrsjekk når den har over-funn, ellers null. */
  gebyrsjekk: GebyrsjekkResultat | null;
  /** «Lag svar». Utelatt når stadiet ikke støtter utkast. */
  utkastHref?: string;
  betalHref?: string;
  /** Knappene vises bare når saken er aktiv og ikke avsluttet. */
  visKnapper: boolean;
  /** Brevet er mer enn 45 dager gammelt: funnet er historikk. */
  historisk?: boolean;
  brevdato?: string | null;
  /** Beløpskontroll, fristfunn og hovedstolavvik som rader. */
  children?: ReactNode;
}) {
  const [aapen, setAapen] = useState(false);
  const knappRef = useRef<HTMLButtonElement>(null);
  const linjer = gebyrsjekk ? overLinjer(gebyrsjekk) : [];
  const flere = linjer.length > 1;
  const hode =
    linjer.length === 1
      ? linjer[0].forklaring
      : `Gebyrsjekken fant ${linjer.length} beløp over maksimalsats.`;
  const synlige = linjer.slice(0, MAKS_LINJER);

  return (
    <section aria-label="Funn" className="rounded-helt border border-kant bg-flate pt-5">
      <p
        className={`flex items-center gap-1.5 px-5 text-[13px] font-semibold ${
          historisk ? "text-dempet" : "text-dom-rod"
        }`}
      >
        <CircleAlert className="size-4" aria-hidden />
        Funn{historisk && brevdato ? ` · fra ${formaterTallDato(brevdato)}` : ""}
      </p>

      {gebyrsjekk && linjer.length > 0 && (
        <>
          <button
            type="button"
            ref={knappRef}
            onClick={() => setAapen(true)}
            aria-label="Se utregning og kilder for gebyrfunnet"
            className="trykk mt-2 block w-full px-5 pb-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blekk"
          >
            <span className="flex items-start gap-2">
              <span className="flex-1 text-[19px] font-semibold leading-snug text-blekk">{hode}</span>
              <ChevronRight className="mt-1.5 size-4 shrink-0 text-dempet" aria-hidden />
            </span>
            <dl className="mt-3 space-y-1.5">
              {synlige.map((l, i) => (
                <div key={i}>
                  {flere && (
                    <dt className="pt-1 text-[13px] font-semibold text-blekk">
                      {KOSTNADSTYPE_ETIKETT[l.linje.type]}
                    </dt>
                  )}
                  <div className="flex items-baseline justify-between gap-3 text-[15px]">
                    <dt className="text-dempet">I brevet</dt>
                    <dd className="font-semibold tabular-nums text-blekk">{kr(l.linje.belop)} kr</dd>
                  </div>
                  {l.maksHoy !== null && (
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <dt className="text-dempet">Høyeste sats</dt>
                      <dd className="font-semibold tabular-nums text-blekk">{kr(l.maksHoy)} kr</dd>
                    </div>
                  )}
                </div>
              ))}
            </dl>
            {linjer.length > MAKS_LINJER && (
              <span className="mt-1.5 block text-[13px] text-dempet">og {linjer.length - MAKS_LINJER} til</span>
            )}
          </button>
          {aapen && (
            <DomFullskjerm
              resultat={gebyrsjekk}
              utkastHref={utkastHref}
              onLukk={() => {
                setAapen(false);
                knappRef.current?.focus();
              }}
            />
          )}
        </>
      )}

      {children && (
        <div className={`divide-y divide-strek border-t border-strek ${linjer.length > 0 ? "mt-3" : "mt-2"}`}>
          {children}
        </div>
      )}

      {visKnapper ? (
        <div className="space-y-2 px-5 pb-5 pt-4">
          {utkastHref && <Primærknapp href={utkastHref}>Lag svar</Primærknapp>}
          {betalHref && (
            <Primærknapp href={betalHref} variant="stille">
              Betalingsløsninger
            </Primærknapp>
          )}
        </div>
      ) : (
        <div className="h-3" />
      )}
    </section>
  );
}
