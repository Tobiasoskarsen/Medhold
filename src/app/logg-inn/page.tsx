"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Primærknapp } from "@/components/ui";
import { KodeFelt, type KodeStatus } from "@/components/ui/KodeFelt";
import { normaliserTelefon, telefonLoginPa } from "@/lib/telefon";
import { ORKESTER_STIGRING, STEG_GLID } from "@/lib/bevegelse";
import { GoogleKnapp } from "./GoogleKnapp";
import { MetodeVeksler } from "./MetodeVeksler";
import { NyttForsokLenke } from "./NyttForsokLenke";
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
type Steg = "inntast" | "kode";

function LoggInn() {
  const router = useRouter();
  const params = useSearchParams();
  const redusert = useReducedMotion();
  const telefonPa = telefonLoginPa();

  const [metode, setMetode] = useState<Metode>("epost");
  const [steg, setSteg] = useState<Steg>("inntast");
  const [epost, setEpost] = useState("");
  const [telefon, setTelefon] = useState("");
  const [sendtTil, setSendtTil] = useState(""); // normalisert kontakt kode gikk til
  const [kodeLengde, setKodeLengde] = useState(KODE_LENGDE);
  // Kodefeltet (KodeFelt, React Bits CodeSlots): status styrer feil-drenering
  // og godkjent-hake; nøkkelen gir et friskt felt for hver nye kode.
  const [kodeStatus, setKodeStatus] = useState<KodeStatus>("idle");
  const [kodeNokkel, setKodeNokkel] = useState(0);
  const kodeRef = useRef<HTMLInputElement | null>(null);
  const [laster, setLaster] = useState(false);
  const feilParam = params.get("feil");
  const [feil, setFeil] = useState<string | null>(
    feilParam === "bekreftelse"
      ? "Innloggingslenken var ugyldig eller utløpt. Prøv igjen."
      : feilParam === "google"
        ? "Innlogging med Google feilet. Prøv igjen, eller bruk e-postkode."
        : null,
  );
  const [melding, setMelding] = useState<string | null>(
    params.get("slettet") ? "Kontoen din og all data er slettet." : null,
  );
  const [nedtelling, setNedtelling] = useState(0);

  useEffect(() => {
    if (nedtelling <= 0) return;
    const t = setTimeout(() => setNedtelling((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [nedtelling]);

  // Skjermorkestrering ved første maling (Motion3 §2.2): H1 → Google-knapp →
  // deler/veksler → felt. Samme «commit start-tilstand, bytt til slutt-
  // tilstand på neste tikk»-mønster som resten av fila (CSS-transitions, ikke
  // motion/react — konsistent med skjermens øvrige mekanikk). Kun ved mount,
  // ingen loop.
  const [vist, setVist] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVist(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function inntredenStil(indeks: number): CSSProperties {
    return {
      opacity: vist ? 1 : 0,
      transform: redusert || vist ? "none" : "translateY(8px)",
      transitionProperty: "opacity, transform",
      transitionDuration: "var(--bevegelse-normal)",
      transitionTimingFunction: "var(--bevegelse-easing)",
      transitionDelay: redusert ? "0ms" : `${indeks * ORKESTER_STIGRING * 1000}ms`,
    };
  }

  // Etter vellykket verifisering: sett har_sett_onboarding hvis det mangler,
  // slik at «Kom i gang»-onboardingen aldri vises igjen for en kjent bruker
  // (Onboarding/Logg inn-arbeidsordre §1.5). E-postkode/SMS har ingen egen
  // server-callback-rute (verifiseringen skjer her, klientsidig) — dette er
  // derfor det funksjonelt tilsvarende stedet til Google sin auth/callback.
  async function settOnboardingSettHvisMangler(
    supabase: ReturnType<typeof createClient>,
    bruker: { user_metadata?: Record<string, unknown> } | null,
  ) {
    try {
      if (bruker && !bruker.user_metadata?.har_sett_onboarding) {
        await supabase.auth.updateUser({
          data: { har_sett_onboarding: true },
        });
      }
    } catch (feil) {
      console.error("Kunne ikke sette har_sett_onboarding", feil);
    }
  }

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
    setKodeStatus("idle");
    setKodeNokkel((n) => n + 1);
    setSteg("kode");
    setNedtelling(30);
    setTimeout(() => kodeRef.current?.focus(), 50);
  }

  async function verifiser(kode: string) {
    setLaster(true);
    setFeil(null);
    const supabase = createClient();
    const { data, error } =
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
      // Feltet drenerer sifrene baklengs og tømmer seg selv; onChange("")
      // til slutt setter status tilbake til idle. Fokus blir stående.
      setKodeStatus("error");
      kodeRef.current?.focus();
      return;
    }
    // Godkjent: feltet samles til én flate med hake. La haken rekke å vises
    // før vi navigerer (hoppes over ved redusert bevegelse).
    setKodeStatus("success");
    const pause = redusert
      ? Promise.resolve()
      : new Promise((ok) => setTimeout(ok, 550));
    await Promise.all([settOnboardingSettHvisMangler(supabase, data.user), pause]);
    router.push("/");
    router.refresh();
  }

  function byttMetode(m: Metode) {
    setMetode(m);
    setFeil(null);
  }

  function tilInntast() {
    setSteg("inntast");
    setNedtelling(0);
  }

  const feltKlasse =
    "mt-1.5 w-full rounded-kontroll border border-strek bg-flate px-[15px] py-3.5 text-[15.5px] text-blekk outline-none focus:border-aksent focus-visible:ring-2 focus-visible:ring-aksent/30";

  // Steg-overgang (opacity + translateX) — samme mønster som onboardingen.
  function stegStil(denneSteg: Steg): CSSProperties {
    const aktiv = steg === denneSteg;
    // "inntast" ligger til venstre for "kode" i rekkefølgen.
    const forlater = denneSteg === "inntast" && steg === "kode";
    return {
      opacity: aktiv ? 1 : 0,
      transform: redusert
        ? undefined
        : `translateX(${aktiv ? 0 : forlater ? -STEG_GLID : STEG_GLID}px)`,
      pointerEvents: aktiv ? "auto" : "none",
      transitionProperty: "opacity, transform",
      transitionDuration: "var(--bevegelse-normal)",
      transitionTimingFunction: "var(--bevegelse-easing)",
    };
  }

  function metodeFeltStil(dennMetode: Metode): CSSProperties {
    const aktiv = metode === dennMetode;
    return {
      opacity: aktiv ? 1 : 0,
      pointerEvents: aktiv ? "auto" : "none",
      transitionProperty: "opacity",
      transitionDuration: "var(--bevegelse-hurtig)",
      transitionTimingFunction: "var(--bevegelse-easing)",
    };
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col">
      <div className="flex min-h-10 items-center px-6 pt-6">
        <button
          type="button"
          onClick={tilInntast}
          className="text-hjelp font-semibold text-dempet"
          style={{
            opacity: steg === "kode" ? 1 : 0,
            pointerEvents: steg === "kode" ? "auto" : "none",
            transitionProperty: "opacity",
            transitionDuration: "var(--bevegelse-hurtig)",
            transitionTimingFunction: "var(--bevegelse-easing)",
          }}
        >
          ‹ Tilbake
        </button>
      </div>

      <div className="relative grid px-6">
        {/* STEG: inntast (kontakt) */}
        <div
          className="[grid-area:1/1] flex flex-col"
          style={stegStil("inntast")}
          aria-hidden={steg !== "inntast"}
        >
          <div style={inntredenStil(0)}>
            <h1 className="tittel-s text-blekk">
              Logg inn i Medhold
            </h1>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-dempet">
              Rolig og trygt — vi trenger bare én ting å sende koden til.
            </p>
          </div>

          <div className="mt-[22px]" style={inntredenStil(1)}>
            <GoogleKnapp />
          </div>

          <div style={inntredenStil(2)}>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-strek" />
              <span className="text-meta text-dempet">eller</span>
              <span className="h-px flex-1 bg-strek" />
            </div>

            {telefonPa && (
              <div className="mb-4">
                <MetodeVeksler metode={metode} onVelg={byttMetode} />
              </div>
            )}
          </div>

          <form
            style={inntredenStil(3)}
            onSubmit={(e) => {
              e.preventDefault();
              if (!laster) sendKode();
            }}
          >
            <div className="relative grid">
              <label
                className="flex flex-col [grid-area:1/1]"
                style={metodeFeltStil("epost")}
              >
                <span className="text-[12.5px] font-semibold text-blekk">
                  E-postadresse
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={epost}
                  onChange={(e) => setEpost(e.target.value)}
                  placeholder="navn@epost.no"
                  className={feltKlasse}
                />
              </label>
              <label
                className="flex flex-col [grid-area:1/1]"
                style={metodeFeltStil("telefon")}
              >
                <span className="text-[12.5px] font-semibold text-blekk">
                  Mobilnummer
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="912 34 567"
                  className={feltKlasse}
                />
              </label>
            </div>

            {melding && (
              <p className="mt-4 text-hjelp text-aksent">{melding}</p>
            )}
            {feil && <p className="mt-4 text-hjelp text-dom-rod">{feil}</p>}
            <div className="mt-[18px]">
              <Primærknapp type="submit" disabled={laster}>
                {laster ? "Sender …" : "Send meg en kode"}
              </Primærknapp>
            </div>
          </form>

          <p className="mt-3.5 pb-8 text-hjelp leading-[1.55] text-dempet">
            Ingen passord å huske — vi sender en engangskode på {kodeLengde}{" "}
            tegn.
          </p>
        </div>

        {/* STEG: kode */}
        <div
          className="[grid-area:1/1] flex flex-col"
          style={stegStil("kode")}
          aria-hidden={steg !== "kode"}
        >
          <h1 className="tittel-s text-blekk">
            Skriv inn koden
          </h1>
          <p className="mt-2.5 text-[13.5px] text-dempet">
            Sendt til <b className="font-semibold text-blekk">{sendtTil}</b>
          </p>

          <div
            className="mt-[22px] flex justify-center"
            style={{
              opacity: steg === "kode" ? 1 : 0,
              transform:
                steg === "kode" || redusert ? "none" : "translateY(8px) scale(0.97)",
              transitionProperty: "opacity, transform",
              transitionDuration: "var(--bevegelse-normal)",
              transitionTimingFunction: "var(--bevegelse-easing)",
              transitionDelay: redusert ? "0ms" : "60ms",
            }}
          >
            <KodeFelt
              key={kodeNokkel}
              length={kodeLengde}
              status={kodeStatus}
              // 8-sifrede koder (Supabase-oppsettet avgjør) må få plass i
              // 420 px-kolonnen: litt mindre felt og tettere avstand.
              slotSize={kodeLengde > 6 ? 38 : 46}
              gap={kodeLengde > 6 ? 6 : 9}
              inputRef={kodeRef}
              tabIndex={steg === "kode" ? 0 : -1}
              ariaLabel={`Engangskode, ${kodeLengde} siffer`}
              onChange={(kode) => {
                if (kode) setFeil(null);
                setKodeStatus((st) => (st === "error" ? "idle" : st));
              }}
              onComplete={(kode) => {
                if (!laster) verifiser(kode);
              }}
            />
          </div>

          <p
            className="mt-3 h-5 text-center text-[12.5px] text-dempet"
            aria-live="polite"
          >
            {laster && kodeStatus === "idle" ? "Sjekker koden …" : ""}
          </p>

          {feil && (
            <p className="mt-1 text-center text-hjelp text-dom-rod">
              {feil}
            </p>
          )}

          <NyttForsokLenke
            sekunder={nedtelling}
            onSendPaNytt={sendKode}
            deaktivert={laster}
          />
          <div className="pb-8" />
        </div>
      </div>

      <p className="mt-auto px-6 pb-8 pt-8 text-center text-xs text-dempet">
        Første innlogging oppretter kontoen din automatisk.
      </p>
    </main>
  );
}
