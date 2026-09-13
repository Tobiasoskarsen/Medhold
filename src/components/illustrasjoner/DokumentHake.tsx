/**
 * Illustrasjonsspråket (MEDHOLD_KOMPLETT_ARBEIDSORDRE Del B) — se
 * TomKonvolutt.tsx for prinsippet.
 */
export function DokumentHake({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" className={className} aria-hidden>
      <path
        d="M20 50 L20 20 L44 20 L52 28 L52 50 Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path d="M44 20 L44 28 L52 28" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M27 34 h18 M27 41 h12" stroke="currentColor" strokeWidth="2" />
      <path
        d="M46 44 l4 4 l7 -8"
        style={{ stroke: "var(--gull)" }}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
