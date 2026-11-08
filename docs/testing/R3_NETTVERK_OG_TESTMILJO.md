# R3 – nettverk og testmiljø, etterkontroll

8. november 2026. Supplerer R3_RELEASE_GATE.md. Ingen merge, produksjons-
migrasjon eller produksjonsdeploy. Juridiske regler og API-kontrakter urørt.

## Beskyttet GitHub-testmiljø

Opprettet `test` med manuell reviewer, `can_admins_bypass=false`, og bare
`main` og `codex/r3-release-gate` som tillatte grener. Self-review er tillatt:
repoeieren må kunne godkjenne sin egen manuelt startede testjobb. Dette er
ikke automatisk godkjenning. Production/Preview er ikke endret.
Se r3-github-test-environment.json og r3-github-test-branches.json.

Automatisk sikkerhetskontroll stanset første forsøk på å overføre nøkler.
Ingen nøkler ble sendt i det avviste forsøket. Brukeren godkjente deretter
eksplisitt de tre testverdiene til akkurat dette GitHub-testmiljøet.
Verdiene ble lest lokalt og overført via stdin til `gh secret set`, ikke
kommandolinjeargumenter, kode eller rapport. Kun secretnavn er lagret i
r3-github-test-secret-names.json. Ingen produksjonsnøkler er overført.

`gh workflow run release-test.yml --ref codex/r3-release-gate` ble forsøkt
én gang etter oppsett. GitHub avviste med 404: workflowen finnes ikke på
default branch. Det er en reell blokkering frem til separat godkjent
integrasjon, ikke manglende secrets lenger. Ingen midlertidig main-commit,
utvidede triggerregler eller omgåelse av review er brukt.

## Lokal nettverksprøve med faktisk klient

Ny localhost-proxy på 3017, kun til den eksisterende testappen på 3015.
Kontrollfilen er gitignorert og kan bryte en valgt POST før videresending
eller kaste svaret etter at serveren har avsluttet. Nexts dev-WebSocket
tunneleres, uten logging av headers. Ingen globale nettverksinnstillinger
eller produksjonsruter endres. r3-network-events.jsonl har bare tidspunkt,
metode, sti, fase og serverAction-flagg. Alle ID-er gjelder syntetiske rader.
Ingen body, query, cookie, token, nøkkel eller dokumenttekst er logget.

Dette er ikke fysisk mobil/offline-testing eller uttømmende dekning av alle
mulige pakketap. Det er en valgt transportfeil mellom en faktisk nettleser
og den lokale Next-klienten/serveren, med ekte test-Supabase.

| Operasjon | Feilinnsprøyting / observasjon | Resultat |
|---|---|---|
| Analyse | POST brutt før server; teksten beholdt, «Les brevet» tilgjengelig | Bestått |
| Generering | /api/utkast-generer brutt før server; detaljer beholdt, feil og retry | Bestått |
| Utkastlagring | Brudd før server; feil uten falsk suksess, tekst beholdt; retry lagret | Bestått |
| Tapt utkastlagringssvar | Serverversjon 3/eksakt tekst kontrollert; UI viste ukjent utfall; ny fane viste lagret tekst | Bestått, feilmelding presisert |
| Sendtregistrering | Brudd før server ga helsidefeil før rettelse; etter rettelse lokal feil, tekst og knapp beholdt | Rettet og bestått |
| Sendt etter serverutførelse | Svar kastet; endelig UI viste skrivebeskyttet sendt tekst; DB-versjon 4 og snapshot==innhold | Bekreftet serverstatus; ikke bevis for alle frontend-interleavings |
| Brevlagring | Brudd før server og tapt svar etter commit; bekreftelsesskjema beholdt, knapper frigitt | Bestått |
| Retry av brev etter tapt svar | To saker/to brev/én frist/ett utkast både før og etter retry; navigerte til samme sak | Ingen duplikat |
| Fristendring | Brudd før server ga helsidefeil før rettelse; etter rettelse lokal feil/knapp beholdt | Rettet og bestått |
| Frist-retry | Nett gjenopprettet; historikk viste fristen fullført og «Angre» | Bestått |

To faktiske klientfeil skyldtes at avviste server-action-promises slapp ut
av async useTransition. Det er nå try/catch rundt sendt-/frist-endring.
Lagringsfeilen var også for bastant: et tapt svar kan følge en vellykket
commit. Teksten sier nå «Kunne ikke bekrefte lagringen» og beholder teksten.
Ingen versjons-/idempotens-/statusregel er endret.

Fire tester i supabase/tests/r3-client-network.test.mjs kjører de faktiske
komponenthandlerne med kontrollerte React/router/action-grenser. De tester
nettverksavvisning, serverfeil og bevart suksessnavigasjon; ikke bare tekstsøk.
De supplerer, og erstatter ikke, den observerte nettleserprøven.

### Testoppsett og opprydding

Bare én ny syntetisk konto. To saker, to brev, én frist og ett utkast ved
sluttkontroll. Sendt-snapshot stemte, versjon 4. Kontoen ble slettet gjennom
admin cleanup og tilhørende testdata kaskaderyddet. Engangstokenet lå bare i
gitignorert fil som ble fjernet; ingen e-post sendt i nettverksprøven.

Brevlagring ble klargjort med et eksplisitt loopback-analysesvar merket
R3SYNTHETIC. Det tester klient/transport/lagring, ikke modellnøyaktighet.
Første modellfixture manglet kostnadslinjens påkrevde tekstfelt. Appen
avviste den korrekt; fixture ble rettet uten svekket validering.
Proxyens første kontrollfillesing traff en delvis skriving; testverktøyet
ble rettet til å la trafikk passere under slik oppdatering. Dette var ikke
en appfeil. Next dev-oppstart/hydrering ble kontrollert før handlingene;
endrede HTML-felt uten React-tilstand ble ikke talt som beståtte tester.

Et lokalt parallelt testløp fikk moduloppslagsfeil under fillesing av
Supabase-pakken i en child-prosess. Resultatet ble ikke ignorert eller
kontrollen svekket; sluttløpet kjøres på nytt etter at dev-serverne stoppes.

Skjermbilder: r3-tapt-lagringssvar.png (før mer presis melding),
r3-sendt-nettverksfeil-rettet.png og r3-frist-nettverksfeil-rettet.png.
Kun syntetisk innhold. Nettverkslogg: r3-network-events.jsonl.

## Fortsatt åpne porter

### Skrivefri produksjons-preflight er gjennomført

Prosjektet ble kontrollert i Supabase-panelet: **Medhold**, prosjekt-ID
`leernzbmuldegiggnjib`, main PRODUCTION, Postgres 17.6. Kun eksisterende
katalog-SELECT-er fra for_0026_0028.sql, for_0029.sql og release_0030.sql
ble kjørt. Ingen app-tabellrader, dokumenter, brukerprofiler eller
produksjonsnøkler ble lest. Ingen migrasjon eller annen skrivende SQL.
Editoren lagret query-metadata i sitt normale brukergrensesnitt; det er
ikke en endring av appens produksjonsskjema/data.

Bevis: `r3-production-release-catalog.csv` (40 katalograder),
`r3-production-migration-preflight.csv` (71 kontrollrader) og
`r3-production-preflight.png`.

Faktisk tilstand: 0024-relasjoner og de relevante 0026-fristkolonnene
finnes. lagre_brev/brev_statusovergang fra 0027 mangler. 0028s
frister_status_konsistent og erstatningskobling mangler; gammel enkelt-FK
for erstattet_av_brev_id finnes fortsatt. 0029s lagringsforsok, kvoter og
kvotebruk/funksjoner mangler. 0030s versjon/sendt_innhold/vakt_fakta og
sendt-RPC/trigger mangler. Følgelig kan 0031s grantmål heller ikke bekreftes
som installert. RLS er aktiv på saker, brev, frister og utkast; eksisterende
eier-/foreldrepolicies er eksportert i katalogfilen.

Dette er objektstatus, ikke en formell migrasjonsjournal. Ikke deploy ny
app mot dette skjemaet. Etter separat godkjenning: sjekk datakonsistens uten
å deaktivere constraints; kjør manglende 0027 → 0028 → 0029 → 0030 → 0031
(kontroller 0024/0026-forutsetninger på nytt), verifiser og ta smoke før
produksjonsutrulling. Ingen produksjonsskriving er autorisert/utført her.

### Sluttkontroller for denne etterkontrollen

389 enhetstester og 90 DB-/modultester bestått, inkludert fire nye
klientregresjoner. Lint uten varsler, typekontroll og produksjonsbygg grønt.
Databasetestene besto uten sandboxens EPERM etter omkjøring; ingen tester
ble fjernet eller svekket. GitHub-CI på oppdatert PR kontrolleres separat.

- iPhone 15 er oppgitt av brukeren. iOS-versjon og fysiske Safari-resultater
  er ikke rapportert ennå. Android/TalkBack er ikke tilgjengelig/verifisert.
- VoiceOver/stor systemtekst, faktisk OS-utklippstavle og ekstern Mail-
  mottaker/emne/body er fortsatt manuelle porter, ikke «bestått» av IAB.
- Google og telefon må testes interaktivt. Ingen metode er fjernet uten
  produktvalg og ingen personlige kontoer er overtatt.
- Gammel app mot oppgradert klone og ny browser-smoke etter endelig merge
  er fortsatt releaseporter. Ingen sammenslått main/release-SHA finnes ennå.
- GitHub-workflowen må kjøres og reviewer-godkjennes etter at filen finnes
  på default branch. Ikke krysset av på grunnlag av lokal CI-env-kjøring.

Ingen beta-/produksjonsgodkjenning mens disse portene står åpne.
