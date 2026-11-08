# R3 – release gate

Utgangspunkt: R2 `10638d5a6c30be33c79179705e899d477436e10a`.
Arbeidsgren: `codex/r3-release-gate`. Ingen produktfunksjoner, nye pakker,
merge, produksjonsmigrasjoner eller produksjonsdeploy.

## Git og kandidat

`r3-pr-stack.json` inneholder faktiske base/head-SHA-er for #52–#61.
Alle ti head-SHA-er er kontrollert med `git merge-base --is-ancestor` mot R3.
Merge-base med origin/main er `6516bd317e4d01816c56e62b8c25a9c6efa2fe3d`.
Ingen rebase eller cherry-pick er utført. #53 og #56 er fortsatt draft.
`r3-git-log.txt` er historikk ved testet kodecommit, ikke påstått
endelig main. Bruk `git rev-parse HEAD` etter endelig integrasjon for NEW_RELEASE_SHA.
Første R3-sjekker gjelder arbeidskopien basert på R2; endelig PR-CI må
bekreftes separat. Ingen produksjonsklar SHA utledes av en preview-URL.

## Automatisering

Verifisert lokalt: 389 enhetstester, 86 DB-/modultester, lint uten varsler,
typekontroll og produksjonsbygg med CI-plassholdere. Produksjonsaudit: null.
R3-smoke: 20/20 (`r3-supabase-smoke.json`). Avsluttende full HTTP-/feilrunde:
26/26 i CI-env-modus (`r3-supabase-release.json`), cleanup=true, mot
kodecommit `26eac900cc9e9ab92b08e0cbb5102e234da1bbce`. Ingen appkode er
endret i R3. Etterfølgende dokumentcommits endrer ikke testet kode.
Nettleserrelease-smoke er ikke kjørt på nytt; R2s reise er historisk bevis,
ikke en erstatning for porten etter endelig sammenslåing.

Normal CI har nå produksjonsbygg og `npm audit --omit=dev --audit-level=high`.
Bygget bruker offentlige plassholderverdier, ikke Supabase-/AI-hemmeligheter.
Den manuelle `release-test.yml` kjører bare via workflow_dispatch, med
serialisering og `cancel-in-progress: false`, Node 24 og miljø `test`.
Før miljøjobben kreves et eksisterende miljø med required_reviewers.
Repoets environment/test-oppslag returnerte 404; beskyttelsen er derfor
ikke hevdet konfigurert. Ingen secrets eller miljørettigheter er lagt til.
Workflowen vil stoppe før integrasjon hvis dette ikke er konfigurert.

Miljøets tre secrets må hete TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY
og TEST_SUPABASE_SECRET_KEY. Testskriptet bruker dem direkte i CI, avviser
manglende/delvis konfigurasjon og feil prosjekt før oppsett. Ingen fallback
til .env.local eller en lokal testfil i CI. To regresjoner verifiserer stopp.
Rapporten fra en tidligere commit slettes før kjøring, slik at en mislykket
jobb ikke laster opp et gammelt grønt resultat. Bare sanitert JSON lastes opp.
Workflowen er klargjort, ikke kjørt med GitHub-secrets. GitHub krever normalt
workflow_dispatch-filen på default-grenen før den blir tilgjengelig i Actions;
det er ikke grunn til å merge uten godkjenning.

## Ekte cron-test

`scripts/test-cron-r3.mjs --send-owned-test-email` krever R3_TEST_EMAIL og
eksakt godkjent test-Supabase. Brukeren oppga eid adresse og autoriserte
testutsendingen. Adressen og nøklene er ikke skrevet til rapport/repo.
Bare en ny syntetisk brukers rader gjøres tilgjengelige for rutemodulen;
andre brukeres påminnelser kan ikke bli sendt. Mottakeroppslaget for akkurat
denne fixturebrukeren peker til den eide adressen. Faktisk cron-modul,
e-postadapter, testdatabase og Resend brukes; det er ikke en nettverks-GET
mot en deployet cron-rute. SQL/RLS-tester er fortsatt separate fra admin-cron.

Resultat: dryRun uten sending, to parallelle kjøringer med samme payload,
én unik melding akseptert av Resend, én kvitteringsrad og retry uten ny
melding. En parallell forespørsel fikk forventet Resend 409. Leverandøroppslag
viste «sent»; brukeren bekreftet deretter nøyaktig én melding i innboksen.
Testkontoen og tilhørende data ble fjernet. Se `r3-cron-resultat.json`.
Første fixture brukte ugyldig kilde og ble stoppet av 23514 før sending;
rettet til eksisterende «manuell», ingen schemaendring eller svekket test.

Ingen exactly-once-påstand: Resends 24-timersvindu og vedvarende feil etter
akseptert melding/kvittering har fortsatt begrensningene i R2-rapporten.

## Migrasjonsmatrise og produksjons-preflight

| Migrasjon | I kode | Testprosjekt | Produksjon |
|---|---|---|---|
| 0024 | Ja | Forutsetning for fungerende relasjoner | Ikke SQL-verifisert |
| 0026 | Ja | Relevante objekter/RPC-test verifisert | Ikke SQL-verifisert |
| 0027 | Ja | Atomisk RPC verifisert | Ikke SQL-verifisert |
| 0028 | Ja | Sammensatte constraints verifisert | Ikke SQL-verifisert |
| 0029 | Ja | Kvoter/idempotens verifisert | Ikke SQL-verifisert |
| 0030 | Ja | Installert og versjon/snapshot testet | Ikke SQL-verifisert |
| 0031 | Ja | Installert; anon avvist med 42501 | Ikke SQL-verifisert |

Kjør senere, med autorisert produksjonslesing, bare
`supabase/kontroll/for_0026_0028.sql`, `for_0029.sql` og `release_0030.sql`.
Sistnevnte viser allerede 0031-særkontrollen for alle relevante signaturer:
anon_execute=false, authenticated_execute=true, security_definer=false på
registrer_utkast_sendt. Manglende rad er ikke bestått. Sammenlign også faktisk
funksjonskropp, grants, triggers og validerte constraints. Katalogbevis er
ikke en komplett migrasjonsjournal. Ingen remote reset eller oppsett.sql.

Arbeidsordrens curl-eksempel brukte p_utkast_id/p_forventet_versjon. Faktisk
signatur er p_id/p_versjon; feil signatur kan gi falskt grønt «ikke-2xx».
Den eksisterende testen bruker korrekt signatur og krever 42501.

## Gjenstående fysiske og interaktive porter

Brukeren har iPhone, men ingen fysisk test er rapportert ennå. Android er
ikke tilgjengelig/verifisert i denne økten. Viewport-emulering er ikke fysisk test.
Utfør med en syntetisk konto i test-preview, og noter modell/OS/nettleser:

1. Safari: innlogging, Hjem, kamera/fil, analyse og bekreftelse. Rett total
   og dato, og se at kontrollgrunnlaget følger feltene.
2. Lagre, åpne sak, generer utkast, rediger med tastatur åpent, lagre og
   refresh. Ingen kritiske kontroller skjules permanent av tastatur/bunnnav.
3. Åpne to faner, lagre A og deretter B. B beholder teksten og viser konflikt.
4. Kopier til Notater og sammenlign hele teksten med lagret autoritativ tekst.
   Åpne Mail-utkast uten å sende til kreditor. Kontroller mottaker, emne og
   full body. Åpning av Mail skal ikke registrere sendt-status.
5. Større tekst/zoom, redusert bevegelse og VoiceOver: labels, fokus inn/ut
   av bunnark, feilmeldinger og gjenoppretting. Ta anonymiserte skjermbilder.
6. Test offline under brevlagring, utkastlagring, sendtregistrering,
   analyse, generering og fristendring. Ingen falsk suksess, lokal tekst
   beholdes og retry lager ikke duplikater. Ta sanitert nettverksbevis.
7. Gjenta kjeden i Android Chrome med TalkBack og stor tekst.

Tilgjengelig nettleserverktøy i denne økten har ikke dokumentert request-
interception/offline-kontroll. Nettverksfeil på serversiden fra R2 brukes
ikke som erstatning for et faktisk frontendbrudd. Google/telefon-flyt er
ikke utført; de er heller ikke deaktivert uten et eksplisitt produktvalg.
Disse portene er åpne, ikke «bestått». Ingen OS-utklippstavle/Mail-kontroll
hevdes bekreftet av at en knapp viste «Kopiert».

## Dev/build-backlog

Åtte moderate auditmarkeringer har samme rot: minimatch globparts-amplification,
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Berørte pakker: minimatch, @typescript-eslint/typescript-estree,
@typescript-eslint/parser, @typescript-eslint/type-utils,
@typescript-eslint/utils, @typescript-eslint/eslint-plugin,
typescript-eslint og eslint-config-next. Dette er ikke åtte uavhengige bugs.
Det gjelder bygg/lint med globmønstre; produksjonsaudit er separat grønn.
Neste sikre bane er en upstream TypeScript-ESLint-versjon som tillater
patchet minimatch, deretter kompatibel eslint-config-next/lockfil, full
lint/type/build/test. Ikke force-downgrade Next eller overstyr minimatchs
hovedversjon uten kompatibilitetsbevis. Følg opp før nye ubetrodde mønstre
kjøres i lintmiljøet. Se R2s maskinlesbare audit for eksakt dependencygraf.

## Merge, deploy og rollback

Ingen merge i R3. Senere: #52 → #53 → #54 → #55 → #56 → #57 → #58 → #59 →
#60 → #61 → R3. Review og ta drafts #53/#56 ut av draft først. Stopp
automatisk produksjonsutrulling under integrasjon. Etter hver squash:
rebase neste gren på ny base, retarget PR, push bare med force-with-lease,
og gjenta checks. Verifiser faktisk ancestry/migrasjoner igjen etter siste
merge, ikke stol på denne rapportens inngående SHA.

OLD_RELEASE_SHA=6516bd317e4d01816c56e62b8c25a9c6efa2fe3d.
NEW_RELEASE_SHA fastsettes først fra endelig main etter godkjent integrasjon.
Deretter én releasekjøring med ekte test-Supabase og feiladapter. Kjør bare
manglende produksjonsmigrasjoner etter separat godkjenning: 0024-forutsetning,
0026 → 0027 → 0028 → 0029 → 0030 → 0031. Ved feil: stopp, ikke fjern RLS
eller constraints. Gammel app mot oppgradert klone er en åpen gate;
kolonnekompatibilitet alene er ikke en slik runtime-test.

Rollback er tidligere dokumenterte deploy/SHA; behold additive data,
versjoner og snapshots. Ikke dropp kolonner eller slett nye brukerdata.
E-post kan ikke «rulles tilbake»; stopp utsending ved uklar kvitteringsstatus.

R3 er ikke godkjent for privat beta før de åpne P1-portene og beskyttet
GitHub-testmiljø er dokumentert. Rapporten er en release-gate, ikke et deployløfte.
