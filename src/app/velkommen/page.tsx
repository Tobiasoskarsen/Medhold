import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/brand";
import { Onboarding } from "./Onboarding";

export const metadata = {
  title: APP_NAME,
};

export default async function VelkommenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Innlogget bruker som allerede har sett onboardingen → rett til Hjem.
  // Ikke-innloggede besøkende ser den alltid (flagget kan ikke finnes
  // pre-innlogging). Direktelenke til /logg-inn omgår denne siden helt.
  if (user?.user_metadata?.har_sett_onboarding) redirect("/");

  return <Onboarding />;
}
