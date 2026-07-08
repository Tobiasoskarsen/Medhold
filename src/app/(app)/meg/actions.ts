"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function lagreFornavn(
  navn: string,
): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  const { error } = await supabase.auth.updateUser({
    data: { fornavn: navn.trim() || null },
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
  const rensket = raw.replace(/[\s-]/g, "");
  let telefon: string | null = null;
  if (rensket) {
    let n = rensket;
    if (n.startsWith("0047")) n = `+${n.slice(2)}`;
    if (/^\d{8}$/.test(n)) n = `+47${n}`; // norsk 8-sifret uten landkode
    if (!/^\+\d{8,15}$/.test(n)) {
      return { feil: "Skriv et gyldig telefonnummer, f.eks. 412 34 567." };
    }
    telefon = n;
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
