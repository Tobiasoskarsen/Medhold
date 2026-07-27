"use client";

import { NavLenke as Link } from "@/components/NavLenke";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { Home, Folder, User, type LucideIcon } from "lucide-react";
import { haptikk } from "@/lib/haptikk";
import { FJAER, IKON_TRYKK_SKALA, INDIKATOR_FJAER } from "@/lib/bevegelse";

/** Flagg som forteller ruteovergangen (template.tsx) at byttet er en fane-
 *  navigasjon → ren fade, ikke dybde-glid (faner er søsken). */
export const FANE_NAV_NOKKEL = "medhold-fane-nav";

type NavPunkt = {
  href: string;
  etikett: string;
  ikon: LucideIcon;
  /** Ekstra sti-prefikser som også markerer punktet som aktivt. */
  ekstra?: string[];
};

const PUNKTER: NavPunkt[] = [
  { href: "/", etikett: "Hjem", ikon: Home },
  { href: "/krav", etikett: "Saker", ikon: Folder },
  { href: "/meg", etikett: "Meg", ikon: User },
];

function erAktiv(pathname: string, p: NavPunkt): boolean {
  if (p.href === "/") return pathname === "/";
  const treff = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  return treff(p.href) || (p.ekstra?.some(treff) ?? false);
}

/**
 * BunnNav — tre punkter (Hjem, Krav, Meg). Fast i bunn på mobil.
 *
 * Glidende indikator (Motion3 §3): en liten strek under aktivt ikon, delt
 * `layoutId` mellom fanene — motion morfer den automatisk til ny posisjon
 * ved navigasjon (BunnNav bor i layout, remountes ikke). Ikonet som
 * AKTIVERES gjør i tillegg ett dupp (skala ned→1 med FJAER): rendres kun som
 * <m.span> når fanen er aktiv, så «dupp»-en spilles nettopp ved bytte, aldri
 * ved re-render eller loop — deaktivering har ingen egen animasjon.
 */
export function BunnNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t-[0.5px] border-strek bg-flate">
      <div className="mx-auto flex w-full max-w-[640px]">
        {PUNKTER.map((punkt) => {
          const { href, etikett, ikon: Ikon } = punkt;
          const aktiv = erAktiv(pathname, punkt);
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktiv ? "page" : undefined}
              onPointerDown={() => {
                haptikk("lett");
                if (!aktiv) {
                  try {
                    sessionStorage.setItem(FANE_NAV_NOKKEL, "1");
                  } catch {
                    /* privat modus e.l. — ignorer */
                  }
                }
              }}
              className={`trykk flex flex-1 flex-col items-center gap-2 px-0 pb-4 pt-3 ${
                aktiv ? "text-aksent" : "text-dempet"
              }`}
            >
              <span className="relative flex items-center justify-center">
                {aktiv ? (
                  <m.span
                    initial={{ scale: IKON_TRYKK_SKALA }}
                    animate={{ scale: 1 }}
                    transition={FJAER}
                  >
                    <Ikon className="size-5" strokeWidth={2} aria-hidden />
                  </m.span>
                ) : (
                  <Ikon className="size-5" strokeWidth={2} aria-hidden />
                )}
                {aktiv && (
                  <m.span
                    layoutId="bunnnav-indikator"
                    className="absolute -bottom-1.5 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-aksent"
                    transition={INDIKATOR_FJAER}
                  />
                )}
              </span>
              <span
                className={`text-[11px] ${aktiv ? "font-medium" : "font-normal"}`}
              >
                {etikett}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
