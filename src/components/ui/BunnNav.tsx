"use client";

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
      className={`trykk flex flex-col items-center gap-1 px-1 py-1 ${
        aktiv ? "text-aksent" : "text-dempet"
      }`}
    >
      <span className="relative flex h-[26px] w-10 items-center justify-center">
        {aktiv && (
          <m.span
            layoutId="bunnnav-indikator"
            className="absolute inset-0 rounded-[13px] bg-aksent/15"
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
      <span className={`text-[10.5px] ${aktiv ? "font-semibold" : "font-normal"}`}>
        {etikett}
      </span>
    </Link>
  );
}

/**
 * BunnNav — flytende pille (designretning 2, ny bunnnav-mockup) med tre
 * punkter (Hjem, Saker, Meg) og en hevet midtknapp til «Legg til brev».
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

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10">
      <div className="mx-auto max-w-[640px] px-4 pb-4">
        <div className="flex h-[66px] items-center justify-around rounded-[26px] border border-strek bg-flate/90 px-2 shadow-[0_12px_32px_rgba(0,0,0,.35)] backdrop-blur-[14px]">
          {venstre.map((punkt) => (
            <NavPunktKnapp key={punkt.href} punkt={punkt} aktiv={erAktiv(pathname, punkt)} />
          ))}
          <Link
            href="/legg-til-brev"
            aria-label="Legg til brev"
            onPointerDown={() => haptikk("lett")}
            className="trykk -mt-[40px] flex size-[52px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(155deg,var(--aksent-dyp),var(--aksent))] text-white shadow-[0_8px_20px_color-mix(in_oklab,var(--aksent-dyp)_35%,transparent),0_0_0_5px_var(--bakgrunn)]"
          >
            <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
          </Link>
          {hoyre.map((punkt) => (
            <NavPunktKnapp key={punkt.href} punkt={punkt} aktiv={erAktiv(pathname, punkt)} />
          ))}
        </div>
      </div>
    </nav>
  );
}
