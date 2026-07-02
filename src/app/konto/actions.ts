"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function settVarsler(
  pa: boolean,
): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    data: { varsler_paa: pa },
  });
  if (error) {
    return { feil: "Kunne ikke lagre innstillingen. Prøv igjen." };
  }
}

export async function slettKontoOgData(): Promise<{ feil: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sletter brukeren i auth.users; kaskaderer til alle tabellene.
  const { error } = await supabase.rpc("slett_egen_konto");
  if (error) {
    return { feil: "Kunne ikke slette kontoen. Prøv igjen." };
  }

  // Rydd opp session-cookien lokalt (brukeren finnes ikke lenger).
  await supabase.auth.signOut();
  redirect("/login?slettet=1");
}
