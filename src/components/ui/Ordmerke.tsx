/**
 * Ordmerke — «Medhold» skrevet ut som ordmerke, med Trappen (identitetsmotivet)
 * som et lite vedheng etter teksten. Én inline SVG som arver `currentColor`
 * (sett via en forelders `text-blekk`) for teksten og de to første
 * trappetrinnene — følger automatisk lys/mørk modus uten to separate filer.
 * Siste trinn er ALLTID gull (`var(--gull)`, satt via `style` for pålitelig
 * CSS-variabel-oppslag i et presentasjonsattributt) — bevisst unntak fra
 * «gull kun ved medhold»-regelen: det er en del av selve merket/logotypen,
 * ikke et statusuttrykk i UI (MEDHOLD_KOMPLETT_ARBEIDSORDRE Del A, guardrail 2).
 */
export function Ordmerke({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 64"
      className={className}
      role="img"
      aria-label="Medhold"
    >
      <text
        x="0"
        y="46"
        style={{ fontFamily: "var(--font-serif)" }}
        fontSize="42"
        fontWeight="600"
        fill="currentColor"
      >
        Me
      </text>
      <text
        x="58"
        y="46"
        style={{ fontFamily: "var(--font-serif)" }}
        fontSize="42"
        fontWeight="600"
        fill="currentColor"
      >
        hold
      </text>
      <g transform="translate(148,10)">
        <rect x="0" y="30" width="7" height="14" rx="2" fill="currentColor" opacity=".5" />
        <rect x="10" y="20" width="7" height="24" rx="2" fill="currentColor" opacity=".75" />
        <rect x="20" y="6" width="7" height="38" rx="2" style={{ fill: "var(--gull)" }} />
      </g>
    </svg>
  );
}
