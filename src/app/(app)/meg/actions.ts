"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normaliserTelefon } from "@/lib/telefon";

/** Fullt navn til brevsignaturen (utkast/actions.ts). Samme user_metadata-felt
 * som lagUtkast selv skriver til etter generering — denne raden gjør det
 * synlig og redigerbart uten å måtte lage et utkast først. */
export async function lagreBrevnavn(
  navn: string,
): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { error } = await supabase.auth.updateUser({
    data: { brevnavn: navn.trim() || null },
  });
  if (error) return { feil: "Kunne ikke lagre. Prøv igjen." };
}

export async function lagreTelefon(
  raw: string,
): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Lagres som valgfritt kontaktfelt nå (SMS-innlogging kobles på senere når
  // en SMS-leverandør er satt opp). Normaliseres til E.164 der det er mulig.
  let telefon: string | null = null;
  if (raw.trim()) {
    telefon = normaliserTelefon(raw);
    if (!telefon) {
      return { feil: "Skriv et gyldig telefonnummer, f.eks. 412 34 567." };
    }
  }

  const { error } = await supabase.auth.updateUser({ data: { telefon } });
  if (error) return { feil: "Kunne ikke lagre. Prøv igjen." };
}

export async function settVarsler(
  pa: boolean,
): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { error } = await supabase.auth.updateUser({
    data: { varsler_paa: pa },
  });
  if (error) return { feil: "Kunne ikke lagre innstillingen. Prøv igjen." };
}

export async function slettKontoOgData(): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  // Sletter brukeren i auth.users; kaskaderer + eksplisitte deletes i RPC-en.
  const { error } = await supabase.rpc("slett_egen_konto");
  if (error) return { feil: "Kunne ikke slette kontoen. Prøv igjen." };

  await supabase.auth.signOut();
  redirect("/logg-inn?slettet=1");
}
