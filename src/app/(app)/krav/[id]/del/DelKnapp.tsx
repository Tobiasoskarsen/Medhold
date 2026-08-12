"use client";

import { Share2 } from "lucide-react";
import { Primærknapp } from "@/components/ui";

/**
 * Del/last ned-knappen for resultatkortet. Bruker Web Share API med selve
 * bildet som vedlegg når nettleseren støtter det (mobil); ellers lastes
 * bildet ned direkte (desktop). Avbryter brukeren selve delingen (native
 * deleark lukket uten valg), tvinges IKKE en nedlasting i tillegg — det var
 * et bevisst valg å ikke dele.
 */
export function DelKnapp({ sakId }: { sakId: string }) {
  const bildeUrl = `/krav/${sakId}/del/bilde`;

  async function del() {
    let fil: File | null = null;
    try {
      const resp = await fetch(bildeUrl);
      const blob = await resp.blob();
      fil = new File([blob], "medhold-resultat.png", { type: "image/png" });
    } catch {
      fil = null;
    }

    if (fil && navigator.canShare?.({ files: [fil] })) {
      try {
        await navigator.share({ files: [fil], title: "Medhold" });
      } catch {
        /* avbrutt eller feilet — brukerens valg, ingen fallback-nedlasting */
      }
      return;
    }

    const a = document.createElement("a");
    a.href = bildeUrl;
    a.download = "medhold-resultat.png";
    a.click();
  }

  return (
    <Primærknapp onClick={del}>
      <span className="inline-flex items-center gap-2">
        <Share2 className="size-4" aria-hidden />
        Del resultatet
      </span>
    </Primærknapp>
  );
}
