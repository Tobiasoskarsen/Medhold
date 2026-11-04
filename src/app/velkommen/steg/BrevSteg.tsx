"use client";

import type { CSSProperties } from "react";
import { DokumentMotiv } from "./DokumentMotiv";

/** Steg 1 av 3: brevet leses. */
export function BrevSteg({
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
        <DokumentMotiv fase={0} aktiv={aktiv} />
      </div>
      <div style={tekstStil}>
        <h1 className="tittel-s mt-8 text-blekk">Forstå brevet ditt</h1>
        <p className="mt-2.5 max-w-[290px] text-sm leading-[1.6] text-dempet">
          Ta bilde, last opp en fil eller lim inn teksten. Medhold hjelper deg å
          lese brevet.
        </p>
      </div>
    </>
  );
}
