"use client";

import { useEffect, useState } from "react";
import { NavLenke as Link } from "@/components/NavLenke";
import { usePathname } from "next/navigation";
import { m } from "motion/react";
import { Plus } from "lucide-react";
import { haptikk } from "@/lib/haptikk";
import { FJAER, IKON_TRYKK_SKALA, INDIKATOR_FJAER } from "@/lib/bevegelse";

/** Flagg som forteller ruteovergangen (template.tsx) at byttet er en fane-
 *  navigasjon → ren fade, ikke dybde-glid (faner er søsken). */
export const FANE_NAV_NOKKEL = "medhold-fane-nav";

type IkonProps = { className?: string };

function HjemIkon({ className }: IkonProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

/** Appens Trapp-motiv som et lite, statisk bunnnav-ikon (ny bunnnav-mockup). */
function SakerIkon({ className }: IkonProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="14" width="4" height="7" rx="1" fill="currentColor" opacity=".55" />
      <rect x="10" y="9" width="4" height="12" rx="1" fill="currentColor" opacity=".8" />
      <rect x="17" y="4" width="4" height="17" rx="1" fill="currentColor" />
    </svg>
  );
}

function MegIkon({ className }: IkonProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

type NavPunkt = {
  href: string;
  etikett: string;
  ikon: (props: IkonProps) => React.JSX.Element;
  /** Ekstra sti-prefikser som også markerer punktet som aktivt. */
  ekstra?: string[];
};

const PUNKTER: NavPunkt[] = [
  { href: "/", etikett: "Hjem", ikon: HjemIkon },
  { href: "/krav", etikett: "Saker", ikon: SakerIkon },
  { href: "/meg", etikett: "Meg", ikon: MegIkon },
];

function erAktiv(pathname: string, p: NavPunkt): boolean {
  if (p.href === "/") return pathname === "/";
  const treff = (h: string) => pathname === h || pathname.startsWith(`${h}/`);
  return treff(p.href) || (p.ekstra?.some(treff) ?? false);
}

function NavPunktKnapp({
  punkt,
  aktiv,
}: {
  punkt: NavPunkt;
  aktiv: boolean;
}) {
  const { href, etikett, ikon: Ikon } = punkt;
  return (
    <Link
      href={href}
      aria-current={aktiv ? "page" : undefined}
      onPointerDown={() => haptikk("lett")}
      // onClick, ikke onPointerDown: da virker fane-flagget også med tastatur.
      onClick={() => {
        if (aktiv) return;
        try {
          sessionStorage.setItem(FANE_NAV_NOKKEL, "1");
        } catch {
          /* privat modus e.l. — ignorer */
        }
      }}
      className={`trykk flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1 ${
        aktiv ? "text-nav-aktiv" : "text-nav-tekst"
      }`}
    >
      <span className="relative flex h-[26px] w-11 items-center justify-center">
        {aktiv && (
          <m.span
            layoutId="bunnnav-indikator"
            className="absolute inset-0 rounded-liten bg-white/8"
            transition={INDIKATOR_FJAER}
          />
        )}
        {aktiv ? (
          <m.span
            className="relative flex"
            initial={{ scale: IKON_TRYKK_SKALA }}
            animate={{ scale: 1 }}
            transition={FJAER}
          >
            <Ikon className="size-5" />
          </m.span>
        ) : (
          <Ikon className="relative size-5" />
        )}
      </span>
      <span className="text-[11px] font-semibold">{etikett}</span>
    </Link>
  );
}

/**
 * BunnNav — flytende, mørk pille (Retning B §4.5) med tre punkter (Hjem,
 * Saker, Meg) og en flat mint +-knapp til «Legg til brev» i midten.
 *
 * Aktivt punkt får en glidende pille-bakgrunn bak ikonet (delt `layoutId`,
 * morfer automatisk til ny posisjon ved navigasjon — samme Motion3 §3-
 * mekanisme som forrige strek-indikator, kun byttet visuelt uttrykk).
 * Ikonet som AKTIVERES gjør i tillegg ett dupp (skala ned→1, FJAER) —
 * uendret fra før.
 *
 * Midtknappen er ny funksjonalitet (ikke i forrige bunnnav): en snarvei til
 * det samme generiske `/legg-til-brev`-inntaket som CTA-ene på Hjem/Saker
 * allerede bruker. Den er IKKE en fane (setter ikke FANE_NAV_NOKKEL) —
 * `/legg-til-brev` er en fullskjermsflyt utenfor (app)-layouten, med sin
 * egen glid-opp-fra-bunn-overgang.
 */
export function BunnNav() {
  const pathname = usePathname() ?? "/";
  const [venstre, hoyre] = [PUNKTER.slice(0, 2), PUNKTER.slice(2)];

  // Mens et tekstfelt har fokus er tastaturet oppe: menyen viker, så den aldri
  // ligger over feltet eller handlingene under det.
  const [skrivFokus, setSkrivFokus] = useState(false);
  useEffect(() => {
    const erFelt = (m: EventTarget | null) =>
      m instanceof HTMLTextAreaElement ||
      m instanceof HTMLSelectElement ||
      (m instanceof HTMLInputElement &&
        !["checkbox", "radio", "button", "submit", "file"].includes(m.type));
    const inn = (e: FocusEvent) => setSkrivFokus(erFelt(e.target));
    const ut = () => setSkrivFokus(false);
    document.addEventListener("focusin", inn);
    document.addEventListener("focusout", ut);
    return () => {
      document.removeEventListener("focusin", inn);
      document.removeEventListener("focusout", ut);
    };
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-10 transition-[transform,opacity] duration-200 ${
        skrivFokus ? "pointer-events-none translate-y-full opacity-0" : ""
      }`}
    >
      <div className="mx-auto max-w-[480px] px-[18px] pb-[var(--nav-luft)]">
        <div
          className="flex h-[var(--nav-hoyde)] items-center justify-around rounded-[22px] border border-nav-kant bg-nav-bg/90 px-2 backdrop-blur-[14px] backdrop-saturate-150"
          style={{ boxShadow: "var(--skygge-hevet)" }}
        >
          {venstre.map((punkt) => (
            <NavPunktKnapp key={punkt.href} punkt={punkt} aktiv={erAktiv(pathname, punkt)} />
          ))}
          <Link
            href="/legg-til-brev"
            aria-label="Legg til brev"
            onPointerDown={() => haptikk("lett")}
            className="trykk flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-mint text-mint-tekst"
          >
            <Plus className="size-6" strokeWidth={2} aria-hidden />
          </Link>
          {hoyre.map((punkt) => (
            <NavPunktKnapp key={punkt.href} punkt={punkt} aktiv={erAktiv(pathname, punkt)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
