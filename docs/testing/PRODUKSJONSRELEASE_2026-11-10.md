# Produksjonsrelease – 10. november 2026

Brukeren godkjente først produksjonsutrulling og migrasjoner, deretter
uttrykkelig vedlikeholdsstans med midlertidig 503-side. Fullført kandidat:
9cfbb17e804af9028001a205bb18ddbaaac1c0c4, samlet main etter PR #52–#62.
PR #63s sperre mot automatiske Git-deployer fra main er beholdt.

## Backup og prøving

Lokal, tilgangsbeskyttet pg_dump-backup av leernzbmuldegiggnjib er tatt av
brukeren. SHA-256 stemte med manifestet og hele arkivet kunne leses.
Backupdata, passord, lokale restore-klynger og private logger er ikke lagt i Git.
Backupen er ikke kryptert og er bundet til brukerens lokale lagring/NTFS-tilgang.

Auth/public ble faktisk gjenopprettet i lokal PostgreSQL 17.11, og både
individuelle migrasjoner og den eksakte atomiske produksjonsbunten ble prøvd.
Antall eksisterende saker/brev/frister/utkast var uendret i den lokale prøven.
Prøveserverne er stoppet. Dette er ikke full gjenoppretting av Supabase:
Storage-filer, prosjektinnstillinger og øvrige administrerte skjemaer er
ikke dekket av auth/public-prøven.

## Produksjonsdatabase

Prosjektidentitet kontrollert i Supabase: Medhold, leernzbmuldegiggnjib, main.
Skrivefri preflight bekreftet manglende lagre_brev/kvoter/utkast-versjon og
ingen inkonsistente frister i den avgrensede kontrollen.

0027 → 0028 → 0029 → 0030 → 0031 ble kjørt i én ytre transaksjon med
lock_timeout=5s, statement_timeout=120s og lås på de fire berørte hovedtabellene.
Samme bunt var prøvd lokalt først. Supabase viste Success etter commit.
Ingen urelaterte migrasjoner, RLS-unntak eller sletting av brukerdata er gjort.
Ingen formell Supabase-migrasjonsjournal påstås oppdatert: dette var SQL Editor.

Etterkontroll: lagre_brev, kvoter og versjonskolonne finnes; sendt-RPC er
avvist for anon og tillatt for authenticated; kvote-RPC er avvist for
authenticated og tillatt for service_role. De kontrollerte funksjonene er
security invoker, RLS er aktiv, fristconstraint er validert, og den avgrensede
fristkontrollen finner fortsatt ingen inkonsistente rader. Alle 11 kontroller
returnerte true. Bilde: r3-production-migration-verified.png.

## Deploy og trafikk

Tidligere produksjon: dpl_Eu9RXYU4oUVgkyuQBGSYTQnvRtt3.
Ny aktiv produksjon: dpl_8RkYoEUfPfdMeVyaqEQKNXyvoJvu.
Offentlig adresse: https://app2-chi-five.vercel.app.

Vercel-pause ble utført etter egen godkjenning, og HTTP 503 DEPLOYMENT_PAUSED
ble kontrollert. Første deploy under pause ble BLOCKED
(dpl_FUnFey81xYbSKPr5h42SABHnDZnN), og CLI-ventingen ble avbrutt. Den tidligere
produksjonsversjonen ble gjenåpnet for å avslutte nedetiden; login svarte 200.
Et nytt bygg med --prod --skip-domain fra ren main-kopi ble READY. Dermed
var stansen lengre enn planlagt; ingen påstand om uavbrutt tilgjengelighet.

Den unike deploy-adressen var beskyttet av Vercel Auth: anonyme HTTP-prøver
som traff denne beskyttelsen ble ikke regnet som appbevis. Ny Medhold-login
ble visuelt kontrollert i den innloggede nettleseren før vercel promote.
Promote lyktes, og prosjektets produksjonspeker ble kontrollert mot ny ID.

Offentlig slutt-smoke:

- /logg-inn: 200, tittel Medhold, også visuelt kontrollert i nettleser.
- /manifest.webmanifest: 200, application/manifest+json.
- Uautorisert utkast-POST: 307 til /velkommen, i tråd med eksisterende proxy.
- Uautorisert cron: 401. Ingen cron/e-post ble utløst med gyldig nøkkel.
- Kun offentlig prosjekt-ID lest fra klientkoden: leernzbmuldegiggnjib.
- autoAssignCustomDomains=true etter gjenopptak; main-Git-sperren beholdes.

HTTP-bevis: r3-production-http-smoke-2026-11-10.json.
Visuelt bevis: r3-production-live.png.

## Bevis og begrensninger

Main-CI og beskyttet, menneskelig godkjent GitHub-test er grønne på samme
SHA. GitHub-integrasjon 20/20 mot testprosjekt, cleanup=true. Den tidligere
lokale fullrunden hadde 26/26 inklusive feiladapter/HTTP. Disse ulike rundene
blandes ikke. Ingen ny ende-til-ende prøve med innlogget produksjonsbruker,
betalingshandling eller produksjons-e-post hevdes utført under denne releasen.
Tidligere iPhone-prøver og kjente Android/systemtekst-begrensninger beholdes.

Automatisk godkjenningskontroll avviste produksjonshemmeligheter til lokal
fil; de ble ikke hentet. Deploy brukte Vercels eksisterende administrerte miljø.
Første pauseforespørsel ble avvist før utførelse; brukeren godkjente deretter
uttrykkelig nedetiden før den faktiske pausen. Ingen avvisning ble omgått.

Ved nytt problem: stans skriving etter godkjenning og bruk kontrollert app-
rollback. Behold additive DB-objekter og sendt-snapshots. Ikke kjør den
destruktive 0029_tilbake.sql som standard rollback. Den lokale backupen og
auth/public-restorebeviset er tilgjengelige privat dersom gjenoppretting må
planlegges. Det er ikke bevist at alle gamle og nye klienter kan skrive trygt
parallelt; gamle faner bør laste siste appversjon.
