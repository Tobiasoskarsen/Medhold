import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Intro } from "./Intro";
import { APP_NAME } from "@/lib/brand";

export const metadata = {
  title: `Velkommen til ${APP_NAME}`,
};

export default async function IntroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");
  // Har brukeren allerede sett introen, hopper vi rett til Hjem.
  if (user.user_metadata?.sett_intro) redirect("/");

  return <Intro />;
}
