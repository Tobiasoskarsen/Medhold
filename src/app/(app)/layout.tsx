import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BunnNav } from "@/components/ui";
import { Bevegelsesramme } from "@/components/Bevegelsesramme";
import { ViewOvergangProvider } from "@/components/ViewOvergang";
import { APP_NAME } from "@/lib/brand";

/**
 * Delt ramme for de innloggede skjermene: auth-vakt, bunn-navigasjon og den
 * ene ansvarsfraskrivelsen (guardrail — vises kun her, ikke gjentatt).
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
        <div className="flex min-h-screen flex-col pb-24">
          <div className="flex-1">{children}</div>
          <p className="mx-auto w-full max-w-[640px] px-5 pb-5 pt-6 text-center text-[11px] leading-relaxed text-dempet">
            {APP_NAME} hjelper deg å holde oversikt — ikke profesjonell
            rådgivning. Bekreft viktige ting med rett instans.
          </p>
          <BunnNav />
        </div>
      </ViewOvergangProvider>
    </Bevegelsesramme>
  );
}
