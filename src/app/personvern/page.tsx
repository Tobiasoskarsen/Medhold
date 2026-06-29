import Link from "next/link";

export const metadata = {
  title: "Personvern — Klarvei",
};

export default function PersonvernPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/saker"
        className="text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Tilbake
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Personvern
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        Kort og ærlig om hvordan dataene dine behandles.
      </p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-slate-700">
        <section>
          <h2 className="mb-1 font-semibold text-slate-900">
            Hva vi lagrer
          </h2>
          <p>
            Vi lagrer det du selv legger inn: saker, frister, neste steg og
            tekst du limer inn for forklaring. Vi samler ikke inn noe utover
            dette, og vi selger eller deler ikke dataene dine.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Hvor det lagres</h2>
          <p>
            Dataene lagres hos vår databaseleverandør (Supabase) i EU. Hver
            bruker har kun tilgang til sine egne data, håndhevet på
            databasenivå.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">AI-forklaringer</h2>
          <p>
            Når du ber om å få et brev forklart, sendes <em>kun</em> teksten du
            limer inn til vår AI-leverandør (Anthropic) for å lage forklaringen.
            Vi sender aldri hele saksbildet ditt automatisk. Resten av appen er
            uten AI.
          </p>
        </section>

        <section>
          <h2 className="mb-1 font-semibold text-slate-900">Slette dataene</h2>
          <p>
            Du kan når som helst slette all data og hele kontoen din under{" "}
            <Link href="/konto" className="underline hover:text-slate-900">
              Min konto
            </Link>
            . Det er endelig og kan ikke angres.
          </p>
        </section>

        <section className="rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
          <h2 className="mb-1 font-semibold">Ikke profesjonell rådgivning</h2>
          <p>
            Klarvei hjelper deg å holde oversikt. Det er ikke en
            offentlig tjeneste og ikke juridisk, medisinsk eller økonomisk
            rådgivning. Bekreft alltid viktige ting med rett instans (NAV, lege,
            advokat, kommune).
          </p>
        </section>
      </div>
    </main>
  );
}
