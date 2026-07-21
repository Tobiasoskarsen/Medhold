"use client";

import { NavLenke as Link } from "@/components/NavLenke";
import { usePathname } from "next/navigation";
import { Home, Folder, User, type LucideIcon } from "lucide-react";
import { haptikk } from "@/lib/haptikk";

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
  { href: "/krav", etikett: "Krav", ikon: Folder, ekstra: ["/brev"] },
  { href: "/meg", etikett: "Meg", ikon: User },
];

function erAktiv(pathname: string, p: NavPunkt): boolean {
  if (p.href === "/") return pathname === "/";
  const treff = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  return treff(p.href) || (p.ekstra?.some(treff) ?? false);
}

/**
 * BunnNav — tre punkter (Hjem, Krav, Meg). Fast i bunn på mobil.
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
              className={`trykk flex flex-1 flex-col items-center gap-0.5 px-0 pb-4 pt-3 ${
                aktiv ? "text-aksent" : "text-dempet"
              }`}
            >
              <Ikon className="size-5" strokeWidth={2} aria-hidden />
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
