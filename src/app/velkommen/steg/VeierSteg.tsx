"use client";

import type { CSSProperties } from "react";
import { DokumentMotiv } from "./DokumentMotiv";

/** Steg 3 av 3: samme brev blir et utkast brukeren kan redigere. */
export function VeierSteg({
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
        <DokumentMotiv fase={2} aktiv={aktiv} />
      </div>
      <div style={tekstStil}>
        <h1 className="tittel-s mt-8 text-blekk">Velg neste steg</h1>
        <p className="mt-2.5 max-w-[290px] text-sm leading-[1.6] text-dempet">
          Få hjelp til å lage et svar eller foreslå en betalingsløsning. Du kan
          redigere utkastet og sende det selv.
        </p>
      </div>
    </>
  );
}
