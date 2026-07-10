// Ett integrasjonspunkt for haptikk, samme mønster som harPluss().
// Byttes til Capacitor Haptics i fase 6 — kun denne fila endres.

export type HaptikkType = "lett" | "suksess";

export function haptikk(type: HaptikkType): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return; // ingen støtte (iOS Safari, desktop) → no-op, kaster aldri
  }
  try {
    navigator.vibrate(type === "suksess" ? [15, 60, 25] : 10);
  } catch {
    // ignorer — haptikk er aldri kritisk
  }
}
