/**
 * Illustrasjonsspråket (MEDHOLD_KOMPLETT_ARBEIDSORDRE Del B): kun to
 * strektykkelser (2px strek / gull-fyll), aldri ansikter — figurer alltid
 * bakfra, i profil, eller abstrahert. Ingen skygger, ingen gradient i selve
 * illustrasjonen. `stroke="currentColor"` arver `text-blekk` fra forelder
 * (følger lys/mørk automatisk); gull er alltid `var(--gull)`, aldri
 * hardkodet — i motsetning til Ordmerkets Trapp-stolpe, som er et bevisst,
 * avgrenset unntak (se Ordmerke.tsx).
 */
export function TomKonvolutt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" className={className} aria-hidden>
      <rect x="12" y="20" width="48" height="34" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 22 L36 42 L60 22" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="52" cy="16" r="9" style={{ fill: "var(--gull)" }} />
      <path
        d="M48 16 l3 3 l6 -6"
        style={{ stroke: "var(--flate)" }}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
