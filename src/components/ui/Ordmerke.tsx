// Tekstbredden til «Medhold» (Schibsted Grotesk 800, 42px, letterSpacing
// -1.5) målt med getBBox() i nettleseren: 175,77 → 176. Hardkodet, slik at
// Trappen står 8 px etter teksten uten måling ved hver rendring (Retning B
// §1.4). Trapp-gruppen er 27 px bred → viewBox-bredde 176 + 8 + 27 = 211.
const TEKST_BREDDE = 176;
const TRAPP_X = TEKST_BREDDE + 8;
const VIEWBOX_BREDDE = TRAPP_X + 27;

/**
 * Ordmerke — «Medhold» som ordmerke, med Trappen (identitetsmotivet) som et
 * lite vedheng etter teksten. Én inline SVG som arver `currentColor` (sett
 * via en forelders `text-blekk`) for teksten og de to første trinnene —
 * følger lys/mørk automatisk. Siste trinn er ALLTID gull (`var(--gull)`,
 * satt via `style` for pålitelig CSS-variabel-oppslag) — bevisst unntak fra
 * «gull kun ved medhold»: det er en del av selve merket, ikke et
 * statusuttrykk i UI.
 */
export function Ordmerke({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_BREDDE} 64`}
      className={className}
      role="img"
      aria-label="Medhold"
    >
      <text
        x="0"
        y="46"
        style={{ fontFamily: "var(--font-sans)" }}
        fontSize="42"
        fontWeight="800"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        Medhold
      </text>
      <g transform={`translate(${TRAPP_X},10)`}>
        <rect x="0" y="30" width="7" height="14" rx="2" fill="currentColor" opacity=".5" />
        <rect x="10" y="20" width="7" height="24" rx="2" fill="currentColor" opacity=".75" />
        <rect x="20" y="6" width="7" height="38" rx="2" style={{ fill: "var(--gull)" }} />
      </g>
    </svg>
  );
}
