"use client";

import { useRef, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Kort } from "@/components/ui";
import { STATUS_ETIKETT, STATUS_STIL, type SakStatus } from "@/lib/types";
import { DELT_OVERGANG_NOKKEL } from "@/lib/bevegelse";
import { useViewOvergang } from "@/components/ViewOvergang";

/**
 * Ett kort i kravlisten. Ved trykk settes `view-transition-name` på nettopp
 * dette kortets navn/beløp (så KUN de morfer til krav-detaljens header, ikke
 * alle kortene), et flagg som forteller detaljens beløp at det kom via en delt
 * overgang (skal ikke telle opp), og navigasjonen kjøres inne i en
 * View-Transition (Motion2 §1).
 *
 * `delNavn`: navnet deler view-transition-name med krav-detaljens H1 KUN når
 * tekstene er garantert like (ingen opprinnelig_kreditor) — ellers ville
 * teksten «hoppe» til noe annet midt i overgangen.
 */
export function Kravkort({
  id,
  navn,
  delNavn,
  belop,
  underlinje,
  status,
}: {
  id: string;
  navn: string;
  delNavn: boolean;
  belop: string | null;
  underlinje: string;
  status: SakStatus;
}) {
  const router = useRouter();
  const { start } = useViewOvergang();
  const navnRef = useRef<HTMLSpanElement>(null);
  const belopRef = useRef<HTMLSpanElement>(null);
  const href = `/krav/${id}`;

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

  return (
    <a href={href} onClick={klikk} className="block">
      <Kort klikkbar className="hover:border-dempet/40">
        <div className="flex items-start justify-between gap-3">
          <span ref={navnRef} className="text-sm font-medium text-blekk">
            {navn}
          </span>
          {belop && (
            <span
              ref={belopRef}
              className="shrink-0 text-sm font-medium text-blekk"
            >
              {belop} kr
            </span>
          )}
        </div>
        {underlinje && <p className="mt-1 text-xs text-dempet">{underlinje}</p>}
        {status === "venter_pa_svar" && (
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STIL.venter_pa_svar}`}
          >
            {STATUS_ETIKETT.venter_pa_svar}
          </span>
        )}
      </Kort>
    </a>
  );
}
