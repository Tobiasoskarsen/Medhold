import type { LucideIcon } from "lucide-react";
import { NavLenke as Link } from "@/components/NavLenke";

/** Felles utseende, så en snarvei som knapp (Få hjelp) ser lik ut som en lenke. */
export const SNARVEI_KLASSE =
  "trykk flex min-h-[52px] w-full items-center gap-2.5 rounded-kontroll border border-kant bg-flate px-3.5 py-2.5 text-left text-sm font-semibold text-blekk";

/**
 * Snarvei — kompakt handling på Hjem: ikon og kort tittel på én rad. Bare til
 * eksisterende mål (ingen nye løfter).
 */
export function Snarvei({
  ikon: Ikon,
  tittel,
  href,
}: {
  ikon: LucideIcon;
  tittel: string;
  href: string;
}) {
  return (
    <Link href={href} className={SNARVEI_KLASSE}>
      <Ikon className="size-5 shrink-0 text-aksent-dyp" strokeWidth={1.75} aria-hidden />
      {tittel}
    </Link>
  );
}
