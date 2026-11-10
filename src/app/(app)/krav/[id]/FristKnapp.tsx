"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { haptikk } from "@/lib/haptikk";
import { endreFrist } from "../actions";

/**
 * Stille rad under en frist: marker den som fullført, eller angre. Fristen
 * slettes aldri, så historikken i saken blir stående.
 */
export function FristKnapp({
  fristId,
  handling,
}: {
  fristId: string;
  handling: "fullfort" | "aktiv";
}) {
  const router = useRouter();
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  function utfor() {
    startTransition(async () => {
      setFeil(null);
      try {
        const r = await endreFrist(fristId, handling);
        if (!r.ok) {
          setFeil(r.feil);
          return;
        }
        haptikk(handling === "fullfort" ? "suksess" : "lett");
        router.refresh();
      } catch {
        setFeil("Kunne ikke bekrefte fristendringen. Prøv igjen, eller åpne saken på nytt for å kontrollere status.");
      }
    });
  }

  const Ikon = handling === "fullfort" ? Check : RotateCcw;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={utfor}
        disabled={venter}
        className={`trykk inline-flex items-center gap-1.5 text-hjelp font-medium hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent disabled:opacity-50 ${
          handling === "fullfort" ? "text-aksent" : "text-dempet"
        }`}
      >
        <Ikon className="size-3.5" aria-hidden />
        {venter
          ? "Lagrer …"
          : handling === "fullfort"
            ? "Marker fristen som fullført"
            : "Angre"}
      </button>
      {feil && <p role="alert" className="mt-1 text-xs text-dom-rod">{feil}</p>}
    </div>
  );
}
