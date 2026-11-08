# R2 – oppfølging av gjenstående punkter

8. november 2026. Supplerer den opprinnelige R2-rapporten; ingen merge eller
produksjonsdeploy. Ingen produksjonsmigrasjon.

## Rettet

- Utkastgenerering hadde ikke et eksplisitt samlet tidsbudsjett innenfor
  funksjonens 60 sekunder. Første generering og eventuell regenerering deler
  nå et 45-sekunders AbortSignal. SDK-retries er av for denne ruten. Det er
  fortsatt maksimalt én innholdsmessig regenerering. Timeout gir feilmarkør,
  ingen ferdigmarkør, ingen lagring og avsluttet kvotereservasjon.
- Cron kunne sende samme e-post parallelt før utsendingsloggen ble skrevet.
  Fristmail bruker stabil bruker/dag-nøkkel, oppfølging stabil saksnøkkel.
  Lik nøkkel sendes også til Resend. Frister sorteres deterministisk. Ukjent
  utsendingshistorikk stopper sending; feil ved kvitteringslagring logges.
- Sendt tekst omtales ikke lenger som redigerbar. Allerede sendt-registrering
  skjules; tekst og faktakontroll beholdes. Kopiering er fortsatt mulig.
- Google-feilnavigasjon bruker dokumentert router.replace, uten å endre OAuth.
- Målrettede oppdateringer innenfor eksisterende pakkeranges fjernet alle
  høye varsler. Åtte moderate varsler gjenstår i TypeScript-ESLint-kjeden,
  gjennom minimatch 10.2.6. Tilbudt automatisk rettelse nedgraderer Nexts
  lintkonfigurasjon; den er ikke brukt. Ingen kontroller er slått av.

## Nytt rettighetsfunn og 0031

Den lokale Supabase-lignende databasen gir funksjoner direkte standardgrants
til anon. 0030 trakk bare tilbake PUBLIC-granten. En ny regresjon viste
`anon_execute=true` etter 0030. Eiersjekk og invoker/RLS var fortsatt aktive;
dette er en unødvendig execute-rettighet, ikke påvist dokumentinnsyn.

0031 trekker tilbake PUBLIC og anon eksplisitt og beholder authenticated.
Den er idempotent, endrer ikke rader og er kjørt bare i testprosjektet
`evvzxblhaxaraaurbhsu`. SQL-kontroll viste false/true, og ekte uinnlogget
PostgREST avviste RPC med 42501. Se `r2-0031-rettigheter.png`.
Ny skrivefri SQL i `supabase/kontroll/release_0030.sql` leser bare kataloger,
viser grants, funksjonsdefinisjoner, policies, triggers og constraints.
Den er testet før 0030 og etter 0031, men ikke kjørt mot produksjon.

## Kontroller og avgrensninger

- Enhetstester: 389 bestått.
- Lokale DB-/modultester: 84 totalt, inkludert fem nye etterkontroller.
- Lint uten errors eller warnings; TypeScript og produksjonsbygg bestått.
- Ekte Supabase-/HTTP-resultater ligger i `r2-supabase-resultat.json`.
  Sluttkjøringen er 26/26 bestått med cleanup=true, etter 0031 i test.
  Den utvidede feilmatrisen inkluderer en faktisk hengende loopback-forbindelse
  uten headers, ikke bare HTTP 408. Syntetiske brukere slettes i finally.
- Cron-testene bruker faktisk rutemodul og e-postadapter med syntetisk
  database/leverandør. De bekrefter nøkkel, payload, parallell kjøring,
  dryRun, autentisering og feil ved historikklesing. De beviser ikke
  virkelig levering gjennom Resend. Ingen ekstern mottaker er kontaktet.
- En testkjøring startet med nettverksbegrenset lokalapp; HTTP-kontrollene
  feilet. Appen ble startet med riktig nettverkstilgang og matrisen kjørt
  på nytt. Ingen assertions eller tilgangskontroller ble svekket.
- En første lokal DB-runde fikk Windows EPERM ved fillesing; identisk
  omkjøring besto uten endring av den aktuelle koden.
- Det genererte tomme testoppsettet er oppdatert med 0031 og testet fra
  bunnen. Oppsettet er aldri kjørt mot et eksisterende Supabase-prosjekt.

## Hva som fortsatt krever en separat releasekontroll

Resend dedupliserer bare i 24 timer. Ved vellykket utsending fulgt av
vedvarende feil i kvitteringslagringen kan oppfølging sendes igjen etter
dette vinduet. Endret payload med samme nøkkel avvises (409), slik at et
endret fristsett samme dag heller kan utebli enn sendes dobbelt. Permanent
leveringsgaranti krever en vedvarende outbox/reservasjon med avstemming;
denne rettelsen påstår ikke «exactly once».
Kilde: [Resends idempotensdokumentasjon](https://resend.com/changelog/idempotency-keys).

Fysisk iOS/Android, ekstern e-postklient, eksakt OS-utklippstavle, VoiceOver/
TalkBack og stor systemtekst er fortsatt ikke demonstrert. Google/telefon-
innlogging krever leverandør-/brukerinteraksjon og er ikke kjørt her.
Produksjonens metadata er ikke kontrollert eller endret. Kjør de skrivefrie
preflight-spørringene med autorisert produksjonstilgang før separat godkjent
utrulling. Migrasjonsrekkefølge inkluderer nå 0031 etter 0030.

Anbefalingen er fortsatt teknisk delvis klar; dette er ikke en godkjenning
av produksjonsrelease eller en påstand om at alle manuelle tester er bestått.
