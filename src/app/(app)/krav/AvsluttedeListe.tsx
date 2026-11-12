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
      <ul className="rounded-helt border border-kant bg-flate px-4 py-1 [&>li+li]:border-t [&>li+li]:border-strek">
        {synlige.map((sak) => (
          <li key={sak.id}>
            <Kravkort {...sak} />
          </li>
        ))}
      </ul>
      {saker.length > MAKS_UTEN_UTVIDELSE && (
        <button
          type="button"
          onClick={() => setVisAlle((v) => !v)}
          aria-expanded={visAlle}
          aria-label={
            visAlle
              ? "Vis færre avsluttede saker"
              : `Vis alle ${saker.length} avsluttede saker`
          }
          className="trykk mt-1 flex min-h-11 w-full items-center justify-center text-hjelp font-semibold text-dempet transition hover:text-blekk"
        >
          {visAlle ? "Vis færre" : `Vis alle ${saker.length}`}
        </button>
      )}
    </>
  );
}
