import { NavLenke as Link } from "@/components/NavLenke";
import { ChevronLeft } from "lucide-react";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Personvern — ${APP_NAME}`,
};

export default function PersonvernPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/meg"
        className="flex items-center gap-1 text-[13px] text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Tilbake
      </Link>

      <h1 className="mt-4 font-serif text-[24px] font-medium tracking-[-0.01em] text-blekk">
        Personvern
      </h1>
      <p className="mt-1.5 text-[13px] text-dempet">
        Kort og ærlig om hvordan dataene dine behandles.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-blekk">
        <section>
          <h2 className="mb-1 font-medium text-blekk">Hva vi lagrer</h2>
          <p className="text-dempet">
            Vi lagrer det du selv legger inn i gjelds- og inkassosakene dine:
            krav, brev, frister, steg og utkast, samt teksten du limer inn eller
            fotograferer for forklaring. Vi samler ikke inn noe utover dette, og
            vi selger eller deler ikke dataene dine.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-medium text-blekk">Hvor det lagres</h2>
          <p className="text-dempet">
            Dataene lagres hos vår databaseleverandør (Supabase) i EU. Hver
            bruker har kun tilgang til sine egne data, håndhevet på
            databasenivå.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-medium text-blekk">AI-forklaringer</h2>
          <p className="text-dempet">
            Når du ber om å få et brev forklart eller lage et utkast, sendes
            teksten du limer inn — eller bildet/PDF-en du laster opp — til vår
            AI-leverandør (Anthropic) for forklaring og transkripsjon. Ved
            bildeinntak lagrer vi ikke selve bildet, kun den transkriberte
            teksten. Vi sender aldri hele saksbildet ditt automatisk.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-medium text-blekk">
            Fødselsnummer og sensitive opplysninger
          </h2>
          <p className="text-dempet">
            Gjeldsbrev inneholder ofte fødselsnummer. Før vi lagrer den innlimte
            eller transkriberte teksten, fjerner vi automatisk gjenkjente norske
            fødselsnumre (erstattet med «[fødselsnummer skjult]»). Vær likevel
            oppmerksom: ved bildeinntak er selve bildet allerede sendt til
            AI-leverandøren for transkripsjon <em>før</em> maskeringen skjer. Ta
            bare med det du trenger, og sladd gjerne fødselsnummer selv før du
            fotograferer.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-medium text-blekk">Slette dataene</h2>
          <p className="text-dempet">
            Du kan når som helst slette all data og hele kontoen din under{" "}
            <Link
              href="/meg"
              className="text-blekk underline decoration-strek underline-offset-2 hover:decoration-dempet"
            >
              Meg
            </Link>
            . Det er endelig og kan ikke angres.
          </p>
        </section>

        <section className="rounded-xl bg-varsel-bg px-4 py-3 text-varsel-tekst">
          <h2 className="mb-1 font-medium">Ikke profesjonell rådgivning</h2>
          <p>
            {APP_NAME} hjelper deg å holde oversikt. Det er ikke en offentlig
            tjeneste og ikke juridisk eller økonomisk rådgivning. Bekreft alltid
            viktige ting med rett instans (namsmann, inkassobyrå, advokat,
            kommune).
          </p>
        </section>
      </div>
    </main>
  );
}
