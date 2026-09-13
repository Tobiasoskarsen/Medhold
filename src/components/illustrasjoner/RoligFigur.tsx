/**
 * Illustrasjonsspråket (MEDHOLD_KOMPLETT_ARBEIDSORDRE Del B) — se
 * TomKonvolutt.tsx for prinsippet. Figuren er bakfra, ansiktsløs.
 */
export function RoligFigur({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" className={className} aria-hidden>
      <circle cx="36" cy="26" r="12" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 58c2-12 10-18 20-18s18 6 20 18"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M50 12 q6 2 6 10"
        style={{ stroke: "var(--gull)" }}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
