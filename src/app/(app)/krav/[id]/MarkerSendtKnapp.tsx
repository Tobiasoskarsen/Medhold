"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { haptikk } from "@/lib/haptikk";
import { markerUtkastSendt } from "./utkast/actions";

/**
 * Stille rad under et usendt utkast på tidslinjen: lar brukere som sendte
 * brevet senere (eller utenfor appen) bekrefte i etterkant.
 */
export function MarkerSendtKnapp({ utkastId }: { utkastId: string }) {
  const router = useRouter();
  const [feil, setFeil] = useState<string | null>(null);
  const [venter, startTransition] = useTransition();

  function bekreft() {
    startTransition(async () => {
      setFeil(null);
      const r = await markerUtkastSendt(utkastId);
      if (!r.ok) {
        setFeil(r.feil);
        return;
      }
      haptikk("suksess");
      router.refresh();
    });
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={bekreft}
        disabled={venter}
        className="trykk inline-flex items-center gap-1.5 text-[13px] font-medium text-aksent hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent disabled:opacity-50"
      >
        <Check className="size-3.5" aria-hidden />
        {venter ? "Lagrer …" : "Jeg har sendt det"}
      </button>
      {feil && <p className="mt-1 text-xs text-red-700">{feil}</p>}
    </div>
  );
}
