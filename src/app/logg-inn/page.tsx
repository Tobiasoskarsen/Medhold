"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Primærknapp } from "@/components/ui";

export default function LoggInnPage() {
  return (
    <Suspense>
      <LoggInn />
    </Suspense>
  );
}

const KODE_LENGDE = 6;

function LoggInn() {
  const router = useRouter();
  const params = useSearchParams();

  const [steg, setSteg] = useState<"epost" | "kode">("epost");
  const [epost, setEpost] = useState("");
  const [siffer, setSiffer] = useState<string[]>(Array(KODE_LENGDE).fill(""));
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState<string | null>(
    params.get("feil") === "bekreftelse"
      ? "Innloggingslenken var ugyldig eller utløpt. Prøv igjen."
      : null,
  );
  const [melding, setMelding] = useState<string | null>(
    params.get("slettet") ? "Kontoen din og all data er slettet." : null,
  );
  const [nedtelling, setNedtelling] = useState(0);
  const bokser = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (nedtelling <= 0) return;
    const t = setTimeout(() => setNedtelling((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [nedtelling]);

  async function sendKode() {
    setLaster(true);
    setFeil(null);
    setMelding(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: epost.trim(),
      options: { shouldCreateUser: true },
    });
    setLaster(false);
    if (error) {
      setFeil("Kunne ikke sende kode. Sjekk e-postadressen og prøv igjen.");
      return;
    }
    setSteg("kode");
    setSiffer(Array(KODE_LENGDE).fill(""));
    setNedtelling(30);
    setTimeout(() => bokser.current[0]?.focus(), 50);
  }

  async function verifiser(kode: string) {
    setLaster(true);
    setFeil(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: epost.trim(),
      token: kode,
      type: "email",
    });
    if (error) {
      setLaster(false);
      setFeil("Koden stemmer ikke. Sjekk e-posten eller be om en ny.");
      setSiffer(Array(KODE_LENGDE).fill(""));
      bokser.current[0]?.focus();
      return;
    }
    router.push("/");
    router.refresh();
  }

  function settSiffer(i: number, verdi: string) {
    const rene = verdi.replace(/\D/g, "");
    if (!rene) return;
    const neste = [...siffer];
    // Lim inn hele koden hvis flere sifre limes i én boks.
    if (rene.length > 1) {
      for (let k = 0; k < KODE_LENGDE - i; k++) neste[i + k] = rene[k] ?? "";
    } else {
      neste[i] = rene;
    }
    setSiffer(neste);
    const nesteTom = neste.findIndex((s) => s === "");
    const fokus = nesteTom === -1 ? KODE_LENGDE - 1 : nesteTom;
    bokser.current[fokus]?.focus();
    if (neste.every((s) => s !== "")) verifiser(neste.join(""));
  }

  function håndterTast(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !siffer[i] && i > 0) {
      const neste = [...siffer];
      neste[i - 1] = "";
      setSiffer(neste);
      bokser.current[i - 1]?.focus();
    }
  }

  function håndterLim(e: ClipboardEvent<HTMLInputElement>) {
    const tekst = e.clipboardData.getData("text").replace(/\D/g, "");
    if (tekst) {
      e.preventDefault();
      settSiffer(0, tekst);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 pt-6">
      <button
        type="button"
        onClick={() => (steg === "kode" ? setSteg("epost") : router.push("/velkommen"))}
        aria-label="Tilbake"
        className="mb-6 -ml-1 flex size-8 items-center justify-center text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Logg inn
      </h1>

      {steg === "epost" ? (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
            Ingen passord å huske — vi sender deg en engangskode på e-post.
          </p>
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!laster) sendKode();
            }}
          >
            <label htmlFor="epost" className="text-[13px] font-medium text-blekk">
              E-postadresse
            </label>
            <input
              id="epost"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={epost}
              onChange={(e) => setEpost(e.target.value)}
              placeholder="navn@epost.no"
              className="mt-1.5 mb-4 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-3 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
            />
            {melding && (
              <p className="mb-3 text-[13px] text-aksent">{melding}</p>
            )}
            {feil && <p className="mb-3 text-[13px] text-red-700">{feil}</p>}
            <Primærknapp type="submit" disabled={laster}>
              {laster ? "Sender …" : "Send kode"}
            </Primærknapp>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-dempet">
            Vi sendte en kode til {epost}. Skriv den inn under.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {siffer.map((s, i) => (
              <input
                key={i}
                ref={(el) => {
                  bokser.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={s}
                onChange={(e) => settSiffer(i, e.target.value)}
                onKeyDown={(e) => håndterTast(i, e)}
                onPaste={håndterLim}
                aria-label={`Siffer ${i + 1}`}
                className={`h-[42px] w-9 rounded-lg border-[0.5px] text-center text-[17px] font-medium text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30 ${
                  s ? "border-aksent" : "border-strek"
                }`}
              />
            ))}
          </div>

          {feil && (
            <p className="mt-4 text-center text-[13px] text-red-700">{feil}</p>
          )}

          <p className="mt-5 text-center text-[13px] text-dempet">
            {nedtelling > 0 ? (
              <span>Send ny kode om {nedtelling} s</span>
            ) : (
              <button
                type="button"
                onClick={sendKode}
                disabled={laster}
                className="text-aksent transition hover:opacity-80 disabled:opacity-50"
              >
                Send ny kode
              </button>
            )}
          </p>
        </>
      )}

      <p className="mt-auto pb-8 pt-8 text-center text-xs text-dempet">
        Første innlogging oppretter kontoen din automatisk.
      </p>
    </main>
  );
}
