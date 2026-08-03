"use client";

import { HelpCircle } from "lucide-react";
import { Utvidbar } from "@/app/(app)/meg/Utvidbar";
import { UtfallVelger } from "./UtfallVelger";

/**
 * «Har du fått svar?»-utvidelsen på «venter på svar»-kortet. Egen client-
 * komponent fordi `Utvidbar` sin `ikon`-prop er en funksjon (LucideIcon) —
 * funksjoner kan ikke sendes som prop over server/client-grensen fra en
 * Server Component (krav-detaljen). Her holdes ikonet og hele kjeden
 * (Utvidbar → UtfallVelger) på klientsiden; siden mottar kun `kravId`
 * (en streng, trygt serialiserbar).
 */
export function VenterPaSvarUtvidelse({ kravId }: { kravId: string }) {
  return (
    <Utvidbar
      ikon={HelpCircle}
      etikett="Har du fått svar? Registrer utfallet"
    >
      <UtfallVelger kravId={kravId} />
    </Utvidbar>
  );
}
