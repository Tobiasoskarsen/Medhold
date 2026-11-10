# Release Fix R1 – gjennomgangsgrunnlag

Utgangspunkt: samlet S1-F, 0693734. PR #52–#59 er fortsatt åpne med de samme base/head-koblingene som ved release-gjennomgangen. Koden forutsetter skjema til og med 0030; ingen migrasjoner eller avhengigheter er endret. Ingen merge eller manuell deploy.

## Fire rettelser

1. **Dokumentkobling:** byggUtkastPrompt kontrollerer autentisert bruker og filtrerer både brev og frister på sak og bruker. Ukjent brev avvises, ikke tomt grunnlag. Begge genereringsinngangene bruker samme bygger før kvote og AI. Manglende brevvalg avvises når saken har brev; manuelle krav uten brev beholder eksisterende utkastmulighet.
2. **Gjenåpning:** lagret brev_id overstyrer URL og nyere brev. Manglende/nullstilt historisk kobling gir begrenset tekstvisning uten mottaker-/sendehandlinger, aldri automatisk erstatningsbrev. Lagret tekst og vaktfakta beholdes. Betalingsmerknaden bruker opprinnelig brevbeløp; avdragsparametere fra URL brukes ikke på lagrede utkast. Saksnummer fra dagens sak fylles ikke inn som historisk dokumentmetadata.
3. **Avdrag:** serveren henter totalen fra validert sak og beregner planen med eksisterende heltallsøre-funksjon. Klientens måneder og siste avdrag må stemme med den beregnede planen; ellers 400 før kvote/AI. Ugyldige, negative, ikke-endelige og subøreverdier avvises. Bare serverplanen tilføres prompt/vakt. Ingen fremtidige renter eller gebyrer beregnes. 10119,50 / 600 betyr 17 avdrag totalt: 16 × 600 + 519,50 (ikke 17 × 600 pluss siste).
4. **Frist/alvorlighet:** klient og server deler kontrollerBrevfunn, som bruker eksisterende beregnFrist, sammenlignFrist og erAlvorligSak. Rå eksplisitt dokumentfrist sendes separat fra vurderingen. Ugyldig dato avvises; manglende dato eller ustøttet type gir ingen oppdiktet lovberegning. Historisk dokumentdato beholdes. Ved avvik fra klientvisningen lagres ingenting, oppdatert alvorlighet returneres og bekreftelsen nullstilles. Bare serverberegnede funn sendes til lagringen ved ny bekreftelse. Ingen nye juridiske regler.

## Tester og bevisnivå

`supabase/tests/release-r1.test.mjs` inngår automatisk i test:db. Testene kjører de faktiske TypeScript-modulene med transportadaptere, ikke alternative implementasjoner av vurderingslogikken.

- Sak A/brev A godtas; feil sak, annen bruker, ukjent ID og manglende valg avvises. Direkte POST-test bekrefter null AI-instansiering og null kvotereservasjon.
- Faktisk UtkastPage kjøres med eldre brev A, nyere B og manipulert URL. Komponentens props beholder A-mottaker/e-post, redigert tekst og vaktfakta. Manglende A gir ingen normal UtkastFlyt.
- Avdrag: desimalt totalbeløp, total under én krone, negative/null/NaN/Infinity, desimale måneder og feil siste avdrag. Direkte POST avviser manipulert plan uten kvote/AI.
- Faktisk lagreBrev kjøres med fanget RPC-payload: serverfunn lagres; manipulert alvorlighet i begge retninger og falskt fristfunn fører ikke til RPC. Ugyldig/manglende dato, ustøttet type og historisk dokumentdato dekkes.

Dette er lokale modul-/serverkomponenttester, ikke ekte PostgREST eller en ny full nettlesertest. Ingen modellkall eller produksjonsdata brukes. Eksisterende S1-testbevis erstattes ikke av disse testene. Samlede test-, lint-, type- og byggresultater oppgis i PR.

## Separat Supabase-integrasjon før beta

1. Tomt Supabase-testprosjekt, ingen produksjonsnøkler/data. Kontroller faktisk eldre skjema og installer nødvendige forutsetninger, deretter 0026 → 0027 → 0028 → 0029 → 0030. Bruk ikke oppsett.sql for tomt prosjekt som oppgraderingsskript i produksjon.
2. Opprett testbrukere A/B, to saker for A og én for B. Logg inn og bruk ekte bruker-JWT-er via PostgREST; service-role brukes bare til isolert oppsett og kvoteadministrasjon.
3. Test generering med A1/brev A1, A1/brev A2 og A1/brev B. De to siste skal stoppe før AI/kvote og ikke avsløre dokumentdata.
4. Lagre utkast fra eldre brev, last opp nyere brev med annen mottaker og beløp, gjenåpne med manipulert URL. Kontroller original mottaker, tekst, fakta og betalingsinformasjon. Test også slettet original og eldre sendt/usendt utkast fra før 0030.
5. Send to parallelle versjonsbetingede PATCH-kall med samme versjon på ulike tilkoblinger: nøyaktig én oppdatering skal lykkes. Test samtidig lagring/senderegistrering; sendt snapshot skal være den autoritative versjonen.
6. B forsøker SELECT/PATCH/DELETE og sendt-RPC på A-utkast: ingen tilgang. Test også feil brev/sak hos samme bruker.
7. To samtidige lagre_brev-kall med samme nøkkel skal returnere samme brev. Fremprovoser feil sent i transaksjonen og kontroller at ingen delvis lagring finnes.
8. Test parallelle kvotereservasjoner, 429, tjenestefeil, frigiving og retry. Ingen overskridelse, dobbel belastning eller feilaktig suksessmelding.
9. Manipuler avdrag og vurderingsfelter via direkte HTTP/action. Kontroller nøyaktig lagret resultat, ny bekreftelse og at gamle historiske funn ikke rekalkuleres ved lesing.
10. Kjør nettleserflyt med to innloggede faner, refresh, mottakerkontroll, kopier/e-post og manuell sendt-bekreftelse. Ingen faktisk e-post sendes. Dokumenter JWT-roller, forventet/observert status og radversjoner uten å publisere nøkler.

Ingen av disse punktene er godkjent som gjennomført mot ekte Supabase i denne endringen. Beta krever fortsatt integrasjonsbevis og separat godkjenning av utrulling.

## Resultat

389 enhetstester, 78 lokale database-/modultester, lint, TypeScript og produksjonsbygg er grønne. Produksjonsbygget har det eksisterende worktree-varselet om flere lockfiler. Ingen nye pakker. En testkjøring kolliderte med filredigering (EPERM); hele DB-suiten ble deretter kjørt på nytt uten samtidige redigeringer og var grønn. Ingen ny full nettleser- eller Supabase-integrasjonstest er påstått utført.
