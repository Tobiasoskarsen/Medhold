"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { haptikk } from "@/lib/haptikk";

const basis =
  "trykk block w-full rounded-[10px] bg-aksent px-3 py-3 text-center text-sm font-medium text-white hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";

/**
 * Primærknapp — full bredde, aksentfarge, hvit tekst. Maks én per skjerm.
 * Render som lenke ved `href`, ellers som knapp. Lett haptikk ved trykk.
 */
export function Primærknapp({
  children,
  href,
  className = "",
  ...knappProps
}: {
  children: ReactNode;
  href?: string;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  if (href) {
    // Eksterne skjemaer (mailto:) skal ikke gjennom next/link-ruteren.
    if (href.startsWith("mailto:")) {
      return (
        <a
          href={href}
          className={`${basis} ${className}`}
          onPointerDown={() => haptikk("lett")}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href}
        className={`${basis} ${className}`}
        onPointerDown={() => haptikk("lett")}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      className={`${basis} ${className}`}
      onPointerDown={(e) => {
        if (!e.currentTarget.disabled) haptikk("lett");
      }}
      {...knappProps}
    >
      {children}
    </button>
  );
}
