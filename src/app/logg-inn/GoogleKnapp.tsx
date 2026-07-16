"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { haptikk } from "@/lib/haptikk";

/** Googles «G» som liten inline-SVG (offisielle fire farger, 18 px). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71a5.41 5.41 0 0 1-.282-1.71c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

/**
 * «Fortsett med Google» — Supabase OAuth (PKCE). redirectTo bygges alltid av
 * location.origin, aldri hardkodet domene. Feiler pent til ?feil=google.
 */
export function GoogleKnapp() {
  const [laster, setLaster] = useState(false);

  async function fortsett() {
    setLaster(true);
    haptikk("lett");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/` },
    });
    // Ved suksess navigerer nettleseren videre til Google. Bare feil returnerer.
    if (error) {
      setLaster(false);
      window.location.href = "/logg-inn?feil=google";
    }
  }

  return (
    <button
      type="button"
      onClick={fortsett}
      disabled={laster}
      className="trykk flex w-full items-center justify-center gap-2.5 rounded-[10px] border-[0.5px] border-strek bg-flate px-3 py-3 text-sm font-medium text-blekk transition hover:border-dempet/40 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aksent"
    >
      <GoogleG />
      {laster ? "Kobler til …" : "Fortsett med Google"}
    </button>
  );
}
