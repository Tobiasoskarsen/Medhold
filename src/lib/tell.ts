import { animate } from "motion/react";
import { FJAER } from "./bevegelse";

/**
 * Animerer et tall 0 → `til` inn i `el.textContent` via `formater` (FJAER-
 * følelse). Oppdaterer DOM direkte — ingen React-state per frame. Delt av
 * `Belop` og `Nedtelling` (Motion2 §5) slik at begge bruker samme motor.
 * Returnerer en stopp-funksjon for opprydding i useEffect.
 */
export function tellOpp(
  el: HTMLElement,
  til: number,
  formater: (avrundet: number) => string,
): () => void {
  const kontroll = animate(0, til, {
    ...FJAER,
    onUpdate: (v) => {
      el.textContent = formater(Math.round(v));
    },
  });
  return () => kontroll.stop();
}
