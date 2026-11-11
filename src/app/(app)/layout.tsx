import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BunnNav } from "@/components/ui";
import { Bevegelsesramme } from "@/components/Bevegelsesramme";
import { ViewOvergangProvider } from "@/components/ViewOvergang";

/**
 * Delt ramme for de innloggede skjermene: auth-vakt og bunn-navigasjon.
 * Forbeholdet (FORBEHOLD i lib/brand.ts) står én gang der appen gir vurderinger
 * (brevforklaring, gebyrsjekk, utkast, Veiene ut), ikke fast på alle skjermer.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/velkommen");

  return (
    <Bevegelsesramme>
      <ViewOvergangProvider>
        <div className="flex min-h-dvh flex-col pb-[var(--nav-plass)]">
          <div className="flex-1 pb-6">{children}</div>
          <BunnNav />
        </div>
      </ViewOvergangProvider>
    </Bevegelsesramme>
  );
}
