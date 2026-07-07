import Link from "next/link";
import { Lock } from "lucide-react";
import { Primærknapp } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: APP_NAME,
};

export default function VelkommenPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ikon.svg" alt="" width={56} height={56} aria-hidden />
        <p className="mt-[18px] text-[22px] font-semibold tracking-[-0.4px] text-blekk">
          {APP_NAME}
        </p>
        <p className="mt-2.5 text-sm leading-[1.55] text-dempet">
          Fått inkassovarsel? Få oversikt, frister og et ferdig utkast til svar
          — samlet på ett sted.
        </p>
      </div>

      <div className="pb-8">
        <Primærknapp href="/logg-inn">Kom i gang</Primærknapp>
        <p className="mt-3.5 text-center text-[13px] text-dempet">
          <Link href="/logg-inn" className="transition hover:text-blekk">
            Jeg har allerede en konto
          </Link>
        </p>
        <div className="mt-5 flex items-center justify-center gap-1.5 border-t-[0.5px] border-strek pt-3.5">
          <Lock className="size-3.5 text-dempet" aria-hidden />
          <span className="text-xs text-dempet">
            Lagret i EU · du eier dataene dine
          </span>
        </div>
      </div>
    </main>
  );
}
