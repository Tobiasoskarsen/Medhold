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
