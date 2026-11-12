"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Tilbakeknapp (R8): 40px rund, 44px trykkflate. Går tilbake i historikken når
 * det finnes en side å gå tilbake til, ellers til Hjem. Brukes der siden ikke
 * har en fast forelder (Meg nås fra både Hjem og Saker).
 */
export function TilbakeKnapp({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Tilbake"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      className={`trykk -ml-1 flex size-11 items-center justify-center rounded-full text-blekk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk ${className}`}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-flate">
        <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
      </span>
    </button>
  );
}
