"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Folder, User, type LucideIcon } from "lucide-react";

type NavPunkt = { href: string; etikett: string; ikon: LucideIcon };

const PUNKTER: NavPunkt[] = [
  { href: "/", etikett: "Hjem", ikon: Home },
  { href: "/krav", etikett: "Krav", ikon: Folder },
  { href: "/meg", etikett: "Meg", ikon: User },
];

function erAktiv(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * BunnNav — tre punkter (Hjem, Krav, Meg). Fast i bunn på mobil.
 */
export function BunnNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t-[0.5px] border-strek bg-flate">
      <div className="mx-auto flex w-full max-w-[640px]">
        {PUNKTER.map(({ href, etikett, ikon: Ikon }) => {
          const aktiv = erAktiv(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 px-0 pb-4 pt-3 transition ${
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
