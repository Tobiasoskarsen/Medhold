import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

const basis =
  "block w-full rounded-[10px] bg-aksent px-3 py-3 text-center text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";

/**
 * Primærknapp — full bredde, aksentfarge, hvit tekst. Maks én per skjerm.
 * Render som lenke ved `href`, ellers som knapp.
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
    return (
      <Link href={href} className={`${basis} ${className}`}>
        {children}
      </Link>
    );
  }
  return (
    <button className={`${basis} ${className}`} {...knappProps}>
      {children}
    </button>
  );
}
