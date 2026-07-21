import { NavLenke as Link } from "@/components/NavLenke";
import { Primærknapp } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: APP_NAME,
};

export default function VelkommenPage() {
  return (
    <main className="inntoning mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ikon.svg" alt="" width={56} height={56} aria-hidden />
        <h1 className="mt-5 font-serif text-[28px] font-medium leading-[1.2] tracking-[-0.01em] text-blekk">
          Fått inkassobrev?
          <br />
          <em className="italic text-aksent-dyp">Du har rettigheter.</em>
        </h1>
        <p className="mt-3 max-w-[280px] text-sm leading-[1.6] text-dempet">
          {APP_NAME} forklarer brevet, kontrollerer gebyrene mot loven og skriver
          svaret for deg. Rolig, steg for steg.
        </p>
      </div>

      <div className="pb-8">
        <Primærknapp href="/logg-inn">Kom i gang</Primærknapp>
        <p className="mt-3.5 text-center text-[13px] text-dempet">
          <Link href="/logg-inn" className="transition hover:text-blekk">
            Jeg har allerede en konto
          </Link>
        </p>
        <p className="mt-5 border-t-[0.5px] border-strek pt-3.5 text-center text-xs text-dempet">
          Gratis å forstå brevet ditt · Norskutviklet
        </p>
      </div>
    </main>
  );
}
