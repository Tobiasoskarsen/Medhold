# Medhold R2 – integrasjon, stabilisering og releasekontroll

Gjennomført 8. november 2026. Ingen merge eller manuell deploy. Ingen produksjonsmigrasjon eller produksjonsendring.

## A. Verifisert miljø

- Gren: `codex/r2-supabase-integrasjon`, basert på R1 `df34568` og hele S1-stakken.
- Eksisterende testprosjekt: **medhold test**, `evvzxblhaxaraaurbhsu`, database/skjema `postgres/public`. Identitet bekreftet i Supabase-panelet og gjennom API, ikke bare fra filnavnet.
- Lokal `.env.test.local` er gitignorert. Publishable- og secret-nøkkel valideres uten utskrift. Produksjonsfilen `.env.local` er ikke redigert.
- Preview-prosjektadresse og publishable-nøkkel er etterkontrollert mot fungerende lokal testkonfigurasjon. Verdiene samsvarer; ingen Vercel-variabel ble endret. Sensitive serververdier kan ikke bekreftes gjennom tomme CLI-uttrekk alene.
- Lokal app på 3014 brukte test-Supabase og lokal pilot. Resend/cron var deaktivert. Separat feilapp på 3015 brukte syntetisk modellnøkkel og loopback-adapter på 3016. Ingen betaling eller e-postsending.
- Før test: 13 saker, 3 brev, 3 frister, 3 utkast. Etter opprydding: samme antall. Ingen tekster fra eksisterende data ble hentet til rapporten.

### Migrasjoner

Skrivefri SQL viste fristkolonner/constraints fra 0026/0028, validert `brev_id_sak_id_key`, `utkast_brev_sak_fkey`, `frister_erstattet_brev_sak_fkey` og `frister_status_konsistent`. `lagre_brev` hadde både advisory-lås og datovurdering fra 0029. Kvoteobjektene fantes. Dette er kontroll av faktiske objekter og funksjonskjennetegn, ikke en påstand om en komplett formell migrasjonsjournal.

0030 manglet alle tre kolonner og sendt-RPC. **Bare 0030 ble installert i testprosjektet** gjennom innlogget SQL-editor. Den additive transaksjonen endret ikke eksisterende tekst. Etterpå var alle tre eldre utkast bevart med versjon 1 og uten oppdiktet sendt-snapshot. Ny RPC/trigger ble deretter testet gjennom ekte PostgREST. Ingen 0031 var nødvendig eller opprettet.

## B. Integrasjonstester

Full maskinlesbar rapport: [r2-supabase-resultat.json](./r2-supabase-resultat.json). Siste kjøring på Next 16.4.5: **24/24 bestått**, `cleanup: true`. Separate samtidige HTTP-forespørsler går gjennom PostgREST; dette er ikke PGlite-simulert parallellitet. Lock-interleaving bestemmes av serveren, og testene hevder ikke å bevise enhver mulig planlegging.

| Test-ID | Scenario / forventning | Faktisk resultat |
|---|---|---|
| HTTP-SERVER-VALIDATION | Feil dokument eller avdrag avvises før AI/kvote; ugyldig chat-body blir 400 | 404/400 som forventet; ingen ny kvotebruk |
| RLS-A/B-saker, brev, utkast, frister (8) | Annen bruker SELECT/UPDATE/DELETE gir ingen rader; eier beholder raden | Bestått begge retninger |
| RLS-INSERT | Annen eier/forelder avvises | Bestått |
| RLS-INSERT-ALL | INSERT mot alle fire tabeller, begge retninger | 42501 |
| RLS-MOVE | Egne barn kan ikke flyttes til annen brukers sak | 42501 |
| FK-CASE | To egne saker kan ikke blandes på brev/frister/utkast | 23503 |
| RPC-OWNER | B kan ikke registrere A-utkast sendt | Avvist |
| CAS-PARALLEL | To PATCH med samme versjon: nøyaktig én lykkes | Én rad oppdatert, versjon 2 |
| SEND-PARALLEL | Redigering/senderegistrering konkurrerer uten stille overskriving | Én vinner, konsistent snapshot; stale forsøk avvises |
| SAVE-IDEMPOTENT | To samtidige lagringer og retry gir samme resultat | Ett brev, én frist, samme ID-er |
| SAVE-ROLLBACK | Sen feil ved steginnsetting ruller hele lagringen tilbake | Ingen sak/kvittering etter feil; rettet retry lykkes |
| QUOTA-PRIVILEGES | Vanlig bruker kan ikke reservere/frigi via administrative RPC-er | Avvist |
| QUOTA-PARALLEL | Fem parallelle reservasjoner ved testgrense 2 | To godkjent, tre avvist; frigiving tillater retry |
| HTTP-AI-TIMEOUT | Lokal leverandør returnerer 408 | Feil `tidsavbrudd`, ingen ferdigmarkør eller lagring |
| HTTP-AI-NETWORK | Lokal leverandør bryter forbindelsen | Feilmarkør, ingen ferdigmarkør eller lagring |
| HTTP-AI-JSON | Ugyldig JSON i leverandørstrøm | Feilmarkør, ingen ferdigmarkør eller lagring |
| HTTP-AI-TRUNCATED | Strøm avsluttes med max_tokens | Feil `avbrutt`, ingen ferdigmarkør eller lagring |

Alle feiltester bekreftet avsluttet kvotereservasjon. Dette tester eksisterende policy for belastning, ikke at alle feil er gratis. Timeout-testen er kontrollert HTTP 408; en virkelig langvarig hengende TCP-forbindelse er ikke målt her.

### Faktisk nettleserreise

1. Innlogging via faktisk Auth-confirm med engangstoken for syntetisk bruker; ingen e-post sendt.
2. Innlimt syntetisk brev analysert med ekte modell. Endring 1288 → 289 viste sumavvik og oppdatert forklaring. Rettet tilbake, bekreftet og lagret gjennom faktisk server action til test-Supabase.
3. Genererte utkast med ekte modell, redigerte, lagret, gjenåpnet og verifiserte samme tekst. Dette er noen få observerte modellkall, ikke bevis på generell modellkvalitet.
4. Nyere brev med annen mottaker/beløp og manipulert URL endret ikke gammelt utkastgrunnlag. Deretter faktisk PNG-opplasting til eksisterende sak, bildeanalyse og eksplisitt saksoppdatering til 9000 kr. Det gamle utkastet beholdt mottaker A og 1288 kr fra sitt opprinnelige brev.
5. To ekte faner: A lagret, B fikk konflikt og beholdt ulagret tekst. Sendt-registrering gjennom UI oppdaterte saken til ventende; snapshot ble kontrollert med bruker-JWT og var identisk med lagret tekst (versjon 4).
6. Fristen ble fullført i UI, og historikken viste fullføringen. Nytt brev ga ny frist og aktiv sak etter eksisterende regler.
7. Kun egen opprinnelig testfixture ble slettet. Snapshot var uendret ved versjon 5; UI viste eksplisitt utilgjengelig grunnlag, bevarte teksten og valgte ikke nyere brev.
8. Viewport faktisk målt på aktiv testfane: 320/390/430/1280 px; dokumentbredde 305/375/415/1265, ingen horisontal overflow i utkastvisningen. Fysiske enheter er ikke testet.
9. Etter sikkerhetsoppdateringen ble innlogging, faktisk server-action-lagring og refresh/gjenåpning kontrollert på nytt på Next 16.4.5. Hele den lengre modell-/opplastingsreisen ble kjørt før oppdateringen; HTTP-integrasjonsmatrisen ble kjørt på nytt etterpå.

Kopier-knappen viste suksess, men verktøyets utklippstavle leste en annen buffer enn nettleseren. Eksakt clipboard-innhold er derfor ikke bekreftet. Mottakerdata ble kontrollert i lagret brev og UI; ekstern e-postklient ble ikke startet og ingen melding sendt.

Skjermbilder med bare syntetiske data: [sendt utkast](./r2-sendt-utkast.png), [versjonskonflikt](./r2-versjonskonflikt.png), [sak etter bildeopplasting](./r2-sak-etter-bildeopplasting.png), [manglende original](./r2-manglende-original.png). Opplastingsfixture: [syntetisk brev](./r2-syntetisk-brev.png).

## C. Feil funnet

### Sikkerhetsvarsler i avhengigheter

Rotårsak: låste eldre Next-/underavhengighetsversjoner. Før-audit for produksjon: 7 varsler (1 critical, 5 high, 1 moderate). Next.js bekrefter blant annet Server Actions-DoS i den brukte versjonen: [offisiell advisory](https://github.com/vercel/next.js/security/advisories/GHSA-m99w-x7hq-7vfj). Proxy-bypass-advisory har særvilkår (Turbopack og én i18n-locale); det er ikke påstått at den kan utnyttes i denne appen: [advisory](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24).

Next og eslint-config-next er oppdatert fra 16.2.9 til 16.4.5. Kun tre ekstra underavhengigheter ble målrettet oppdatert innenfor eksisterende ranges: baseline-browser-mapping, source-map-js og zod. Ingen ny direkte pakke, ny AI-modell eller ny AI-SDK. Produksjonsaudit etterpå: **0 varsler**. Full audit inkluderer fortsatt 13 build-/utviklingsvarsler (4 high, 9 moderate), dokumentert separat; ingen `audit fix --force` eller nedgradering av lintkontroller er brukt.

### Brevchat krasjet på null-body

`src/app/api/brev-samtale/route.ts` leste `body.brevId` fra null. Den nye regresjonen feilet først med TypeError. Nå returneres 400 for null/array/primitiv JSON før AI og kvote. Både lokal modulregresjon og ekte innlogget HTTP-test er grønne. Dette endrer ikke strømprotokollen.

### Ikke-blokkerende observasjoner

- Faktavakten kan gi en forsiktig advarsel når en negert betalingspåstand får et beløp fra brevet som ikke sto eksplisitt i brukerens detaljer. Advarselen blokkerer ikke lagring; vakten er ikke svekket for å få testen grønn.
- Sendt-utkast er skrivebeskyttet, men har fortsatt generisk tekst om redigering/sending. Dette er en språk-/UX-begrensning, ikke feil i snapshotet.
- Første lokale sluttkontrollfixture manglet et obligatorisk brevfelt; fixtureoppsettet ble korrigert. Det var ingen feil i appen, og den opprettede testkontoens data er ryddet.

## D. Kodeendringer

- `scripts/test-supabase-r2.mjs`: opt-in mot eksakt testprosjekt, ekte bruker-JWT-er, RLS, constraints, parallellitet, atomisitet, kvoter, HTTP-validering og feilinnsprøyting. Unike prefikser og opprydding kun av egne opprettede identiteter/data. Rapporter uten JWT, passord eller dokumenttekst.
- `scripts/r2-fault-app.mjs`: separat lokal Next-app og loopback-modelladapter. Ingen virkelig modellnøkkel, e-post eller cron.
- `src/app/api/brev-samtale/route.ts` og `supabase/tests/release-r1.test.mjs`: minimal null-body-rettelse og regresjon.
- `package.json`, `package-lock.json`: sikkerhetsoppdateringer beskrevet over. `AGENTS.md` er automatisk oppdatert av Next; opphavet er kontrollert i `generate-agent-files.js`.
- Denne rapporten, JSON-resultater, audit før/etter/full og syntetiske skjermbilder/fixture. `PROSJEKT_STATUS.md` oppdateres. Ingen ny SQL-migrasjon; ingen grunn til 0031.

## E. Sikkerhet

RLS ble testet med `authenticated`-JWT fra ekte Auth, kontrollert sub/issuer/rolle. Service-role ble bare brukt til kontrollert oppsett, administrativ kvotetesting og opprydding, ikke brukerens CRUD/RLS-tester. Hemmelige nøkler ble ikke skrevet til repo eller nettleser; frontend bruker den offentlige publishable-nøkkelen. Engangsinnloggingen for syntetiske kontoer er forbrukt; midlertidig lokal sessionsfil er slettet og kontoene fjernet.

SQL-kontrollen viste `security invoker` på lagre_brev og kvotefunksjonene. Anon hadde ikke execute; authenticated hadde lagre_brev, men ikke kvoteadministrasjon. 0030 bruker invoker og eier-/versjonslås. Eksisterende testdata ble beholdt; prosjektet ble ikke nullstilt.

## F. Testresultater og kommandoer

| Kontroll | Resultat |
|---|---|
| npm test | 389 bestått |
| npm run test:db | 79 bestått |
| Ekte Supabase + lokal HTTP/feiladapter | 24/24 bestått på Next 16.4.5 |
| npm run lint | Exit 0; én ny regel advarer på eksisterende window.location.href i GoogleKnapp.tsx, ingen errors |
| TypeScript | Bestått |
| npm run build | Bestått, Next 16.4.5 |
| npm audit --omit=dev | 0 varsler |
| Full audit | 13 utviklings-/buildvarsler, se r2-audit-all.json |

Kjør normal databaserunde med lokal testfil (ingen produksjonsfallback):

```bash
node scripts/test-supabase-r2.mjs --run-test-project
```

For lokal feiladapter, stopp annen Next dev først (deler generert dev-cache), deretter i to terminaler:

```bash
node scripts/r2-fault-app.mjs
node scripts/test-supabase-r2.mjs --run-test-project --app-url=http://localhost:3015 --fault-upstream
```

Reell Supabase-testing bør kjøres manuelt før release, eventuelt workflow_dispatch i et beskyttet testmiljø. Ikke på alle PR-er/forks med service-role. Ingen nye GitHub-hemmeligheter eller tilgangsrettigheter er konfigurert her. Eksisterende CI beholdes.

### Curl-eksempel med egen bruker-JWT

Kun syntetiske test-ID-er. Ikke bruk service-role som brukerautorisasjon, ikke bruk verbose/trace, og ikke lim nøkler i chat. Stdin-konfigurasjon holder headerverdier utenfor curl-kommandolinjen:

```bash
test "$TEST_URL" = "https://evvzxblhaxaraaurbhsu.supabase.co" || exit 1
curl --silent --show-error --config - <<EOF
url = "$TEST_URL/rest/v1/utkast?id=eq.$UTKAST_ID&select=id,versjon"
header = "apikey: $TEST_PUBLISHABLE_KEY"
header = "Authorization: Bearer $USER_A_JWT"
EOF
```

CAS-oppdatering: to separate prosesser med samme forventede versjon skal totalt oppdatere én rad:

```bash
test "$TEST_URL" = "https://evvzxblhaxaraaurbhsu.supabase.co" || exit 1
curl --silent --show-error --config - <<EOF
url = "$TEST_URL/rest/v1/utkast?id=eq.$UTKAST_ID&versjon=eq.$VERSJON&sendt_at=is.null"
request = "PATCH"
header = "apikey: $TEST_PUBLISHABLE_KEY"
header = "Authorization: Bearer $USER_A_JWT"
header = "Content-Type: application/json"
header = "Prefer: return=representation"
data = "{\"innhold\":\"Syntetisk testendring\"}"
EOF
```

## G. Releaseplan

**Faktisk rollback-mål:** Vercel-produksjonsdeploy `dpl_Eu9RXYU4oUVgkyuQBGSYTQnvRtt3`, alias app2-chi-five.vercel.app, metadata `gitCommitSha=6516bd317e4d01816c56e62b8c25a9c6efa2fe3d`, status READY. Produksjonsdeployen ble kun lest.

**Produksjonens migrasjonsstatus er ikke avlest fra autoriserte SQL-metadata i denne runden.** Ikke anta at den bare mangler 0030 eller bare har 0026. Før utrulling må relevante policyer, funksjonsdefinisjoner, grants, kolonner og constraints sammenlignes skrivefritt. Testprosjektets status er ikke bevis for produksjon.

Merge-rekkefølge: #52 → #53 → #54 → #55 → #56 → #57 → #58 → #59 → #60 → R2-PR. Alle eksisterende PR-er ble observert mergeable mot sine nåværende baser. #53 og #56 er fortsatt drafts. Hold automatisk produksjonsutrulling tilbake under integrasjon. Ved squash må neste gren rebaseres/retargetes og kontrollene kjøres igjen; ikke behandle dagens grønne status som evig gyldig.

Etter produksjons-preflight og separat godkjenning: bare manglende migrasjoner, i avhengighetsrekkefølge 0026 → 0027 → 0028 → 0029 → 0030 (med 0024 som forutsetning). Ikke bruk oppsett.sql på eksisterende database. Test tidligere app mot oppgradert skjema før release. Deploy ett dokumentert release-SHA, ikke en tilfeldig mellomgren. Ny SHA fastsettes fra den endelige sammenslåtte committen, ikke gjett ut fra dagens stakk.

Rollback: rull applikasjonen tilbake til verifisert forrige deploy/SHA. Behold additive kolonner, versjoner, kvitteringer og sendt-snapshots; ikke slett nye brukerdata. Feil i en migrasjons transaksjon skal rulle denne tilbake; stopp og undersøk ved constraint-feil fremfor å deaktivere kontrollen. Eventuell midlertidig funksjonsstans krever en konkret godkjent løsning, ikke uthuling av RLS eller kvoter.

Etter godkjent utrulling: syntetisk smoke-konto, brev med beløpsretting, eksisterende sak, frist, utkast, lagring/refresh, to faner, sendt-snapshot, feil dokumentkobling og 429. Kontroller faktisk mottaker og clipboard manuelt uten å sende. Verifiser at cron ikke sender duplikater i et eget kontrollert testløp før ekte utsending; ingen ekte cron-utsending ble gjort her.

## H. Endelig anbefaling

**Delvis klar, med konkrete gjenstående kontroller.** Kjerneintegrasjonen er nå bekreftet mot ekte test-Supabase, inkludert P0-RLS, dokumentkoblinger, samtidig lagring og snapshots. Ingen feil i disse kontrollene gjenstår. Produksjonsrelease er ikke godkjent eller utført.

Gjenstående: produksjons-preflight/migrasjonstillatelse, manuell e-postklient/clipboard-kontroll, fysisk Safari/Android, stor systemtekst/skjermleser, OS-reduced-motion og et kontrollert cron-/påminnelsesløp uten eksterne mottakere. Google/telefon-innlogging er ikke kjørt i denne runden. En faktisk langvarig hengende nettverksforbindelse og alle mulige avbrudd under frontendlagring er ikke uttømmende testet. Historiske eldre utkast er skjemakontrollert og testet lokalt; eksisterende testbrukeres gamle dokumentinnhold er ikke åpnet for å demonstrere alle UI-tilfeller.

Full audit av buildverktøy må vurderes separat; ingen farlig force-fix ble brukt for å skjule funn. Teknisk testberedskap er ikke juridisk godkjenning eller en full personvernvurdering av ekte inkassobrev. Modellnøyaktighet er ikke bevist av denne lille syntetiske reisen.
