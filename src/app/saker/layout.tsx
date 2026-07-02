import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topplinje from "@/components/Topplinje";
import Bunntekst from "@/components/Bunntekst";

export default async function SakerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Vis intro/onboarding første gang, til den er fullført eller hoppet over.
  if (!user.user_metadata?.onboardet) redirect("/velkommen");

  return (
    <div className="flex min-h-screen flex-col">
      <Topplinje epost={user.email} />
      <main className="flex-1">{children}</main>
      <Bunntekst />
    </div>
  );
}
