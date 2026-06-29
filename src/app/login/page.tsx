"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

type Modus = "logg-inn" | "registrer";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginSkjema />
    </Suspense>
  );
}

function LoginSkjema() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modus, setModus] = useState<Modus>("logg-inn");
  const [epost, setEpost] = useState("");
  const [passord, setPassord] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(
    searchParams.get("feil") === "bekreftelse"
      ? "Bekreftelseslenken var ugyldig eller utløpt. Prøv igjen."
      : null,
  );
  const [melding, setMelding] = useState<string | null>(
    searchParams.get("slettet")
      ? "Kontoen din og all data er slettet."
      : null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil(null);
    setMelding(null);

    const supabase = createClient();

    if (modus === "logg-inn") {
      const { error } = await supabase.auth.signInWithPassword({
        email: epost,
        password: passord,
      });
      if (error) {
        setFeil("Feil e-post eller passord.");
        setLaster(false);
        return;
      }
      router.push("/saker");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: epost,
        password: passord,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) {
        setFeil(error.message);
        setLaster(false);
        return;
      }
      // Hvis e-postbekreftelse er på, finnes ingen aktiv session ennå.
      if (data.session) {
        router.push("/saker");
        router.refresh();
      } else {
        setMelding(
          "Sjekk e-posten din og bekreft adressen for å komme i gang.",
        );
        setLaster(false);
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo />
        <p className="mt-4 text-sm text-slate-500">
          Oversikt over saker, frister og neste steg — én ting av gangen.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setModus("logg-inn");
              setFeil(null);
              setMelding(null);
            }}
            className={`rounded-md py-2 font-medium transition ${
              modus === "logg-inn"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Logg inn
          </button>
          <button
            type="button"
            onClick={() => {
              setModus("registrer");
              setFeil(null);
              setMelding(null);
            }}
            className={`rounded-md py-2 font-medium transition ${
              modus === "registrer"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Registrer deg
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">E-post</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={epost}
              onChange={(e) => setEpost(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              placeholder="din@epost.no"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Passord</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                modus === "logg-inn" ? "current-password" : "new-password"
              }
              value={passord}
              onChange={(e) => setPassord(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              placeholder="Minst 6 tegn"
            />
          </label>

          {feil && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {feil}
            </p>
          )}
          {melding && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {melding}
            </p>
          )}

          <button
            type="submit"
            disabled={laster}
            className="mt-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {laster
              ? "Vent litt …"
              : modus === "logg-inn"
                ? "Logg inn"
                : "Opprett konto"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Dette er et verktøy for å holde oversikt — ikke profesjonell rådgivning.
      </p>
      <p className="mt-2 text-center text-xs text-slate-400">
        <Link href="/personvern" className="underline hover:text-slate-600">
          Personvern
        </Link>
      </p>
    </main>
  );
}
