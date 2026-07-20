import { APP_NAME } from "@/lib/brand";

/**
 * Medhold-merket: trappen som stiger, siste trinn i gull, med haken hvilende
 * på toppen — reisen ender i et bekreftet resultat. Selvstendig marine-brikke
 * med appens egne farger (marine/gull), lik i lyst og mørkt tema (som et
 * app-ikon).
 */
export function Medholdmerke({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 84" className={className} aria-hidden>
      <rect x="2" y="2" width="80" height="80" rx="20" fill="#21456E" />
      <rect x="16" y="50" width="12" height="16" rx="3" fill="#F7F6F2" opacity="0.55" />
      <rect x="34" y="38" width="12" height="28" rx="3" fill="#F7F6F2" opacity="0.8" />
      <rect x="52" y="24" width="12" height="42" rx="3" fill="#D9B25E" />
      <path
        d="M52.5 16.5 L57 21 L66 12"
        fill="none"
        stroke="#F7F6F2"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Medholdmerke className="size-[22px]" />
      <span className="text-sm font-medium tracking-tight text-[color:var(--blekk)]">
        {APP_NAME}
      </span>
    </span>
  );
}
