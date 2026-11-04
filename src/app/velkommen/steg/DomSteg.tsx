"use client";

import type { CSSProperties } from "react";
import { DokumentMotiv } from "./DokumentMotiv";

/** Steg 2 av 3: gebyr og dato markeres i samme brev. */
export function DomSteg({
  aktiv,
  illustrasjonStil,
  tekstStil,
}: {
  aktiv: boolean;
  illustrasjonStil: CSSProperties;
  tekstStil: CSSProperties;
}) {
  return (
    <>
      <div style={illustrasjonStil}>
        <DokumentMotiv fase={1} aktiv={aktiv} />
      </div>
      <div style={tekstStil}>
        <h1 className="tittel-s mt-8 text-blekk">
          Få oversikt over gebyrer og frister
        </h1>
        <p className="mx-auto mt-2.5 max-w-[290px] text-sm leading-[1.6] text-dempet">
          Vi sjekker støttede gebyrer mot maksimalsatsene og viser aktuelle
          frister. Du kontrollerer opplysningene mot brevet.
        </p>
      </div>
    </>
  );
}
