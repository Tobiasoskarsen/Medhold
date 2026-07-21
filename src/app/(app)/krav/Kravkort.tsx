"use client";

import { m } from "motion/react";
import { NavLenke as Link } from "@/components/NavLenke";
import { Kort } from "@/components/ui";
import { STATUS_ETIKETT, STATUS_STIL, type SakStatus } from "@/lib/types";
import { DELT_OVERGANG_NOKKEL } from "@/lib/bevegelse";

/**
 * Ett kort i kravlisten. Klientkomponent (ikke inline i den async server-
 * siden) fordi den setter et sessionStorage-flagg ved trykk — server-
 * komponenter kan ikke sende funksjons-props (Motion2 §1: signaliserer til
 * krav-detaljens beløp at det kommer via en delt overgang).
 * `delNavn`: navnet deler layoutId med krav-detaljens H1 KUN når tekstene er
 * garantert like (ingen opprinnelig_kreditor) — ellers ville teksten hoppe
 * til noe annet midt i glidet.
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
  return (
    <Link
      href={`/krav/${id}`}
      className="block"
      onPointerDown={() => {
        try {
          sessionStorage.setItem(DELT_OVERGANG_NOKKEL, "1");
        } catch {
          /* privat modus e.l. — ignorer */
        }
      }}
    >
      <Kort klikkbar className="hover:border-dempet/40">
        <div className="flex items-start justify-between gap-3">
          {delNavn ? (
            <m.span
              layoutId={`sak-navn-${id}`}
              className="text-sm font-medium text-blekk"
            >
              {navn}
            </m.span>
          ) : (
            <span className="text-sm font-medium text-blekk">{navn}</span>
          )}
          {belop && (
            <m.span
              layoutId={`sak-belop-${id}`}
              className="shrink-0 text-sm font-medium text-blekk"
            >
              {belop} kr
            </m.span>
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
    </Link>
  );
}
