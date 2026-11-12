"use client";

import { UserRound } from "lucide-react";
import { Utvidbar } from "./Utvidbar";
import { Brevnavn } from "./Brevnavn";
import { Telefon } from "./Telefon";

/**
 * «Brevnavn og telefon»-raden på Meg. Egen klientkomponent fordi ikonet er en
 * funksjon og ikke kan sendes som egenskap fra serversiden til Utvidbar.
 */
export function BrevnavnRad({
  navn,
  telefon,
  innlogging,
}: {
  navn: string;
  telefon: string;
  innlogging: string;
}) {
  return (
    <Utvidbar ikon={UserRound} etikett="Brevnavn og telefon">
      <div className="flex flex-col gap-4">
        <Brevnavn start={navn} />
        <Telefon start={telefon} />
        <p className="text-hjelp text-dempet">Innlogging: {innlogging}</p>
      </div>
    </Utvidbar>
  );
}
