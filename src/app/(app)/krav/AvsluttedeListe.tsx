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
      <ul className="rounded-kort border border-kant bg-flate px-4 [&>li+li]:border-t [&>li+li]:border-strek">
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
          className="mt-1 block min-h-11 w-full text-center text-hjelp text-dempet transition hover:text-blekk"
        >
          Vis alle ({saker.length})
        </button>
      )}
    </>
  );
}
