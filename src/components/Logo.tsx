import { APP_NAME } from "@/lib/brand";

/**
 * Medhold-merket: to hule «brev»-noder over en fylt grønn node med hake —
 * saker som samles og lander på et medhold. Bruker faste merkevarefarger
 * (ikke currentColor), slik at merket ser likt ut uansett tekstfarge.
 */
export function Medholdmerke({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 84" className={className} aria-hidden>
      <line
        x1="42"
        y1="14"
        x2="42"
        y2="48"
        stroke="#1C2B33"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="42" cy="18" r="8" fill="#F7F7F5" stroke="#1C2B33" strokeWidth="6" />
      <circle cx="42" cy="36" r="8" fill="#F7F7F5" stroke="#1C2B33" strokeWidth="6" />
      <circle cx="42" cy="60" r="14" fill="#0E7C66" />
      <path
        d="M34 60 L40 66 L51 54"
        fill="none"
        stroke="#FFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Medholdmerke className="size-[18px]" />
      <span className="text-sm font-medium tracking-tight text-[color:var(--blekk)]">
        {APP_NAME}
      </span>
    </span>
  );
}
