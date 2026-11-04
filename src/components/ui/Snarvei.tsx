import type { LucideIcon } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";

/**
 * Snarvei — én rute i rutenettet «Hva vil du gjøre?» på Hjem: ikon, kort
 * tittel, én linje forklaring. Bare til eksisterende mål (ingen nye løfter).
 */
export function Snarvei({
  ikon: Ikon,
  tittel,
  tekst,
  href,
}: {
  ikon: LucideIcon;
  tittel: string;
  tekst: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="trykk flex min-h-[92px] flex-col rounded-kort border border-kant bg-flate p-3.5"
      style={{ boxShadow: "var(--kort-skygge)" }}
    >
      <Ikon className="size-[22px] text-aksent-dyp" strokeWidth={1.75} aria-hidden />
      <span className="radtittel mt-2 text-blekk">{tittel}</span>
      <span className="radtekst mt-0.5">{tekst}</span>
    </Link>
  );
}
