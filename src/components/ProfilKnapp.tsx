import { NavLenke as Link } from "@/components/NavLenke";

/**
 * Profilknappen (R8): 40px rund, fjordgrønn, med initialene. Meg er ikke lenger
 * en fane, så dette er veien dit fra Hjem og Saker. Navnet leses av
 * skjermlesere som «Profil».
 */
export function ProfilKnapp({ initialer, className = "" }: { initialer: string; className?: string }) {
  return (
    <Link
      href="/meg"
      aria-label="Profil"
      className={`trykk flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blekk focus-visible:ring-offset-2 focus-visible:ring-offset-bakgrunn ${className}`}
    >
      {/* Selve sirkelen er 40px; lenken er 44px, så trykkflaten er stor nok. */}
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-knapp text-[14px] font-bold text-knapp-tekst">
        {initialer}
      </span>
    </Link>
  );
}
