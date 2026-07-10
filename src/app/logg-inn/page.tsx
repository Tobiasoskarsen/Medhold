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
import { normaliserTelefon, telefonLoginPa } from "@/lib/telefon";
import { beOmKode } from "./actions";

export default function LoggInnPage() {
  return (
    <Suspense>
      <LoggInn />
    </Suspense>
  );
}

const KODE_LENGDE = 6;
type Metode = "epost" | "telefon";

function LoggInn() {
  const router = useRouter();
  const params = useSearchParams();
  const telefonPa = telefonLoginPa();

  const [metode, setMetode] = useState<Metode>("epost");
  const [steg, setSteg] = useState<"inntast" | "kode">("inntast");
  const [epost, setEpost] = useState("");
  const [telefon, setTelefon] = useState("");
  const [sendtTil, setSendtTil] = useState(""); // normalisert kontakt kode gikk til
  const [kodeLengde, setKodeLengde] = useState(KODE_LENGDE);
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

    let lengde = KODE_LENGDE;
    let til = "";

    if (metode === "epost") {
      const r = await beOmKode(epost);
      if (!r.ok) {
        setFeil(r.feil);
        setLaster(false);
        return;
      }
      lengde = r.lengde;
      til = epost.trim();
    } else {
      const tlf = normaliserTelefon(telefon);
      if (!tlf) {
        setFeil("Skriv et gyldig telefonnummer, f.eks. 412 34 567.");
        setLaster(false);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: tlf,
        options: { shouldCreateUser: true },
      });
      if (error) {
        setFeil("Kunne ikke sende SMS-kode nå. Prøv igjen, eller bruk e-post.");
        setLaster(false);
        return;
      }
      til = tlf;
    }

    setLaster(false);
    setSendtTil(til);
    setKodeLengde(lengde);
    setSiffer(Array(lengde).fill(""));
    setSteg("kode");
    setNedtelling(30);
    setTimeout(() => bokser.current[0]?.focus(), 50);
  }

  async function verifiser(kode: string) {
    setLaster(true);
    setFeil(null);
    const supabase = createClient();
    const { error } =
      metode === "epost"
        ? await supabase.auth.verifyOtp({
            email: sendtTil,
            token: kode,
            type: "email",
          })
        : await supabase.auth.verifyOtp({
            phone: sendtTil,
            token: kode,
            type: "sms",
          });
    if (error) {
      setLaster(false);
      const hvor = metode === "epost" ? "e-posten" : "meldingen";
      setFeil(`Koden stemmer ikke. Sjekk ${hvor} eller be om en ny.`);
      setSiffer(Array(kodeLengde).fill(""));
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
    if (rene.length > 1) {
      for (let k = 0; k < kodeLengde - i; k++) neste[i + k] = rene[k] ?? "";
    } else {
      neste[i] = rene;
    }
    setSiffer(neste);
    const nesteTom = neste.findIndex((s) => s === "");
    const fokus = nesteTom === -1 ? kodeLengde - 1 : nesteTom;
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

  function byttMetode(m: Metode) {
    setMetode(m);
    setFeil(null);
  }

  return (
    <main className="inntoning mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6 pt-6">
      <button
        type="button"
        onClick={() =>
          steg === "kode" ? setSteg("inntast") : router.push("/velkommen")
        }
        aria-label="Tilbake"
        className="mb-6 -ml-1 flex size-8 items-center justify-center text-dempet transition hover:text-blekk"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <h1 className="text-[21px] font-medium tracking-[-0.3px] text-blekk">
        Logg inn
      </h1>

      {steg === "inntast" ? (
        <>
          {telefonPa && (
            <div className="mt-4 inline-flex self-start rounded-[10px] border-[0.5px] border-strek bg-flate p-0.5">
              {(["epost", "telefon"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => byttMetode(m)}
                  aria-pressed={metode === m}
                  className={`trykk rounded-lg px-4 py-1.5 text-[13px] font-medium transition ${
                    metode === m ? "bg-aksent text-white" : "text-dempet"
                  }`}
                >
                  {m === "epost" ? "E-post" : "Telefon"}
                </button>
              ))}
            </div>
          )}

          <p className="mt-4 text-[13px] leading-relaxed text-dempet">
            {metode === "epost"
              ? "Ingen passord å huske — vi sender deg en engangskode på e-post."
              : "Ingen passord å huske — vi sender deg en engangskode på SMS."}
          </p>

          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!laster) sendKode();
            }}
          >
            {metode === "epost" ? (
              <>
                <label
                  htmlFor="epost"
                  className="text-[13px] font-medium text-blekk"
                >
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
              </>
            ) : (
              <>
                <label
                  htmlFor="telefon"
                  className="text-[13px] font-medium text-blekk"
                >
                  Telefonnummer
                </label>
                <input
                  id="telefon"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="412 34 567"
                  className="mt-1.5 mb-4 w-full rounded-[10px] border-[0.5px] border-strek bg-flate px-3.5 py-3 text-sm text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30"
                />
              </>
            )}
            {melding && <p className="mb-3 text-[13px] text-aksent">{melding}</p>}
            {feil && <p className="mb-3 text-[13px] text-red-700">{feil}</p>}
            <Primærknapp type="submit" disabled={laster}>
              {laster ? "Sender …" : "Send kode"}
            </Primærknapp>
          </form>
        </>
      ) : (
        <>
          <p className="mt-4 text-[13px] leading-relaxed text-dempet">
            Vi sendte en kode til {sendtTil}. Skriv den inn under.
          </p>
          <div className="mt-6 flex justify-center gap-1.5">
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
                className={`h-[42px] w-8 rounded-lg border-[0.5px] text-center text-[17px] font-medium text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30 ${
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
