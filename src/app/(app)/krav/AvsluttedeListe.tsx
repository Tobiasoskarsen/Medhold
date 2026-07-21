"use client";

import { useState, type ComponentProps } from "react";
import { Kravkort } from "./Kravkort";

const MAKS_UTEN_UTVIDELSE = 5;

/**
 * Avsluttet-gruppen: viser de 5 nyeste, med en dempet «Vis alle (K)»-knapp
 * som utvider på klient (Sakslisteordre §2.3). Ingen ny rute, ingen paginering.
 */
export function AvsluttedeListe({
  saker,
}: {
  saker: ComponentProps<typeof Kravkort>[];
}) {
  const [visAlle, setVisAlle] = useState(false);
  const synlige = visAlle ? saker : saker.slice(0, MAKS_UTEN_UTVIDELSE);

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {synlige.map((sak) => (
          <li key={sak.id}>
            <Kravkort {...sak} />
          </li>
        ))}
      </ul>
      {!visAlle && saker.length > MAKS_UTEN_UTVIDELSE && (
        <button
          type="button"
          onClick={() => setVisAlle(true)}
          className="mt-3 block w-full text-center text-[13px] text-dempet transition hover:text-blekk"
        >
          Vis alle ({saker.length})
        </button>
      )}
    </>
  );
}
