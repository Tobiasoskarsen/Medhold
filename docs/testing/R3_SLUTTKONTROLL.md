# R3 – samlet sluttkontroll 8. november 2026

Gjeldende oversikt etter feilretting og ny integrasjonsrunde. Tidligere R3-
rapporter er bevis fra sine respektive tidspunkt; åpne punkter der er ikke
automatisk gjeldende her. Ingen merge, produksjonsdeploy eller migrasjon er
utført i denne runden. Ingen produksjonsdata er brukt i testene.

## Rettet

1. Saksreferansen TEST-IPHONE-01 ble ikke gjenkjent av tallvakten fordi den
   hadde færre enn fire sifre. 01 ble derfor både et tillatt beløp og en
   misvisende «1 kr»-rad. Korte referanser med bokstaver og skilletegn er nå
   tokens. Endrede referanser gir fortsatt token-advarsel, og et reelt «1 kr»
   som ikke finnes i grunnlaget gir fortsatt beløpsadvarsel. Ingen vakt er
   slått av. Nye fakta bygges korrekt; eksisterende lagrede fakta omskrives ikke.
2. En eksplisitt frist som stemte med lovberegningen ble lagret som beregnet.
   Felles fristKildeForDato brukes i bekreftelse, lagreBrev og saksvisning.
   Serveren korrigerer også gamle klienters feilmerkede input. Historiske rader
   vises med riktig kilde bare når samme tilknyttede brev har lagret eksplisitt
   dato som stemmer med raden. Manuelle og andre datoer endres ikke. Ingen
   historiske databaserader eller juridiske beregninger er endret.
3. Faneglimtet med redusert bevegelse ble rettet i f760eef og fysisk retestet
   av brukeren på iPhone 15/Safari. Se R3_IPHONE15_MANUELL.md.

De to første feilene ble gjenskapt med røde tester før rettelsen 0ef2ec1.

## Nye bevis

| Kontroll | Resultat og avgrensning |
|---|---|
| Enhetstester | 391 grønne, inklusive saksreferanse og fristkilde |
| DB-/modultester | 97/97 grønne, inklusive ny opt-in-regresjon; CI kjører også hele suiten |
| Type/lint/bygg | npx tsc --noEmit, npm run lint og npm run build grønne |
| Produksjonsaudit | npm audit --omit=dev --audit-level=high: 0 funn |
| Supabase/PostgREST/HTTP | 26/26 mot testprosjekt evvzxblhaxaraaurbhsu, ekte bruker-JWT, cleanup=true |
| Gammel kode mot oppgradert test | 4/4 avgrensede prøver fra eksakt gammel SHA; se nedenfor |
| Faktisk nettleser, verdioversikt | 1288/1250/38 ble vist, ingen «1 kr» fra referansen |
| Faktisk nettleser, eldre feilmerket frist | «Fristen står oppgitt i brevet», historikk uten feil beregnet-merking |
| Faktisk nettleser, to faner | A lagret, B beholdt egen tekst og viste konflikt, ny tredje fane viste As lagrede tekst |
| Fysisk iPhone, opplasting | Brukeren bekreftet bilde og PDF hver for seg gjennom lesing, bekreftelse og lagring uten stopp; kamerakilde/størrelse ikke spesifisert |
| Fysisk iPhone, kamera | Nytt bilde via kamera i Safari, deretter lesing, bekreftelse og lagring: brukerbekreftet bestått |

Supabase-rapporten er docs/testing/r2-supabase-resultat.json, kjøringsrevisjon
0ef2ec1. Testen omfatter RLS A/B, kryss-sak/-brev, samtidighet, sendt-snapshot,
idempotens, sen rollback, parallelle kvoter og 429, timeout, nettverksfeil,
ugyldig JSON, avkuttet output og faktisk hengende leverandørforbindelse.
Den lokale modellen er en kontrollert feiladapter: dette beviser transport og
feilhåndtering, ikke modellnøyaktighet eller juridisk kvalitet.

Nettleserprøven brukte faktisk Next-klient og test-Supabase, med kun én ny
syntetisk konto. Sluttstatus: én sak, ett brev, én frist, ett utkast, versjon 4.
Konto og data er slettet etter prøven. Brukerens egen testkonto er urørt.
Dette var skrivebordsnettleser, ikke fysisk iPhone/Android.

Skjermbilder (bare syntetiske data):

- r3-to-faner-konflikt.png
- r3-eksplisitt-frist-rettet.png

## Bakoverkompatibilitet og rollback

Kommando: node scripts/test-legacy-r3.mjs --run-test-project.
Rapport: r3-legacy-resultat.json. Kilden lastes fra Git-objektet
6516bd317e4d01816c56e62b8c25a9c6efa2fe3d, ikke en omskriving av gammel logikk.
Servermodulene kjøres mot faktisk PostgREST/RLS med en ny syntetisk brukers
JWT. Bare oppsett og opprydding bruker service-role. Next cache/navigation,
UI-komponentreferanser og Pluss-sidegate er testgrenser; ingen AI/e-post kjøres.

Bestått: gammel lagreBrev oppretter sak/brev/frist/steg, gammel utkastinnsetting
får riktige standardverdier, gammel utkastside kan lese sitt dokument, gammel
sendt-handler oppretter korrekt snapshot og venter-status, retry endrer ikke
versjonen igjen. Kontoen ryddes, cleanup=true.

Dette er **ikke** en full gammel browserapp mot en produksjonsklone. Den gamle
klienten mangler ny CAS-lagring og kan ikke gis samme samtidighetsgaranti som
den nye. Gammel side kan heller ikke presentere alle nye lagringsfunksjoner.
En rollback må derfor beholde additive data/snapshots og stanse skriving til
en kontrollert klientversjon er aktiv. Det er ikke forsvarlig å love sømløs
blandet gammel/ny skriving bare fordi schemaet er additivt.

Første forsøk på det nye testverktøyet fikk en rapportfeil (lokalt URL-navn
skygget standardklassen) etter cleanup. Verktøyet ble rettet og hele prøven
kjørt på nytt; bare den fullførte rapporten er bestått.

## Reproduserbare kommandoer

    npm test
    npm run test:db
    npm run lint
    npx tsc --noEmit
    npm run build
    npm audit --omit=dev --audit-level=high
    node scripts/test-legacy-r3.mjs --run-test-project

For full HTTP-feilrunde: start scripts/r2-fault-app.mjs separat, kjør deretter
node scripts/test-supabase-r2.mjs --run-test-project --app-url=http://localhost:3015 --fault-upstream.
Stopp testappen etterpå. Begge eksterne testskript krever korrekt .env.test.local
med nøyaktig testprosjekt; ingen produksjonsfallback. Ikke legg nøkler i rapport.

## Porter agenten ikke kan erklære bestått

- VoiceOver-prøven på iPhone er brukerbekreftet bestått («funka jo fint»),
  men er ikke en full tilgjengelighetsaudit av alle flyter.
- Fysisk iPhone: stor systemtekst og
  konfliktprøven på selve telefonen gjenstår. Bilde- og PDF-opplasting er
  brukerbekreftet bestått, se tabellen over. Desktopprøven erstatter ikke
  de øvrige fysiske prøvene.
- Fysisk Android/Chrome/TalkBack er ikke tilgjengelig/testet.
- Google i test er deaktivert og utsatt etter brukerens valg. Telefonlogin
  og faktisk mottaker i Mail er ikke verifisert.
- Full historisk browserapp mot oppgradert isolert klone gjenstår; de fire
  runtime-prøvene over dekker bare de oppgitte serveroperasjonene.
- Beskyttet GitHub-testworkflow finnes ikke på main og kan derfor ikke startes
  med workflow_dispatch ennå. Ingen merge eller svekkelse av reviewer er brukt
  for å omgå dette. Lokale reelle integrasjonstester er ikke en GitHub-kjøring.
- Slutt-smoke etter godkjent integrasjon må gjentas på endelig main-SHA.
- Produksjon mangler nødvendige 0027–0031-objekter ifølge skrivefri preflight.
  Ingen ny app skal rulles ut mot dette før separat godkjent plan er gjennomført.
- Den tidligere moderate dev-auditkjeden er ikke endret; produksjonsaudit er
  separat grønn. Ingen pakker er installert/oppgradert i denne rettelsen.

## Kontrollert videre rekkefølge

1. Lukk fysiske porter, avklar test-Google separat, og gjennomgå PR-diffene.
2. Ved eksplisitt integrasjonsgodkjenning: behold produksjonsutrulling stoppet,
   integrer #52–#62 i base/head-rekkefølge, verifiser ancestry og checks etter
   hver squash/rebase. Drafts #53, #56 og #62 krever gjennomgang først.
3. Kjør beskyttet GitHub-jobb fra main med menneskelig miljøgodkjenning og kun
   testsecrets. Gjenta full HTTP-runde og browser-smoke på endelig kandidat.
4. Avklar og prøv en konkret mekanisme for skrivestans under migrasjon/rollback.
   Ikke start produksjonsmigrasjoner med gamle skrivende klienter i omløp.
5. Etter separat produksjonsgodkjenning: skrivefri preflight igjen, kontroller
   0024/0026-forutsetninger, kjør kun manglende 0027 → 0028 → 0029 → 0030 → 0031.
   Stopp ved avvik; ikke fjern RLS/constraints. Deploy først etter godkjent kontroll.
6. Slutt-smoke og deretter begrenset beta. Ved feil: skrivestans, godkjent
   tidligere SHA, behold additive data/snapshots. Ingen destruktiv DB-rollback.

**Anbefaling:** Feilrettelsene er verifisert i test. Produksjon og full
releasegodkjenning er fortsatt blokkert av de navngitte portene; dette er
ikke en påstand om at alt fysisk eller produksjonsmessig er ferdig.
