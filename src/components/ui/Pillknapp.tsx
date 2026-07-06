import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

const basis =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-aksent px-[22px] py-3 text-sm font-medium text-white transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent focus-visible:ring-offset-2 disabled:opacity-60";

/**
 * Pillknapp — som primærknapp, men helt avrundet. Brukes kun til
 * «Legg til brev».
 */
export function Pillknapp({
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
