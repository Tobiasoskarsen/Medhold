# R3 – fysisk iPhone-test

8. november 2026, Europe/Oslo. iPhone 15; iOS-versjon ikke oppgitt.
Test-preview for `codex/r3-release-gate`, kode-/dokumenttopp dd9f05e.
Brukeren bekreftet Safari. De første bildene så ut til å være fra en
innebygd nettleser; de alene ble ikke brukt som bevis for Safari.

Dette er brukerutført og rapportert testing, med vedlagte bilder i chatten.
Agenten har ikke fjernstyrt eller instrumentert telefonen. Originalbilder
er ikke kopiert inn i det offentlige repoet: noen inneholder brukerens navn.
Kun syntetisk sak «Eksempel AS», TEST-IPHONE-01, ble brukt.

## Bekreftet gjennom testreisen

| Kontroll | Bevis / avgrensning |
|---|---|
| Tilgang til preview | Vercel-innlogging passert, Medholds innlogging nådd |
| E-postinnlogging | Brukeren kom til Hjem; OTP ikke delt |
| Tekstanalyse | Bilder viste 1288 total, 1250 hovedstol, 38 purregebyr og 22. november som frist |
| Beløpsretting og bekreftelse | Brukeren bekreftet avvik ved 289, retting tilbake og handlingsvalg etter bekreftelse |
| Brevlagring | Saksbildet viste Eksempel AS, 1288 kr og 22. november |
| Pluss-testtilgang | Paywall stoppet reisen. Kun bekreftet testkonto fikk plan=pluss; ingen betaling, pilot- eller produksjonsendring |
| Utkastgenerering | Ferdig utkast vist; bruker bekreftet redigering med tastatur og tilgjengelige kontroller |
| Serverlagring av endring | Første bilde viste lokal gjenoppretting/ulagret, og ble ikke godkjent. Brukeren lagret deretter eksplisitt og bekreftet ny setning og «Utkast lagret» i en ny Safari-fane |
| OS-utklippstavle | Hele teksten, inkludert ny setning, limt inn i Notater og bekreftet av brukeren |
| Ekstern e-postklient | Emne og hele teksten bekreftet. Mottaker kan være tom siden testbrevet ikke hadde e-postadresse; ikke bevis på korrekt utfylt mottaker |
| Åpning er ikke sending | Bildet etter e-poståpning viste fortsatt sendt-knappen som en tilgjengelig handling |
| Manuell sendt-registrering | Brukeren trykket bare på den syntetiske saken og bekreftet «Venter på svar». Ingen e-post sendt i denne prøven |
| Beholdt sendt tekst | Gjenåpnet fra historikk, ny setning beholdt, skrivebeskyttet, bekreftet av brukeren |
| Friststatus | Fullført, refresh og «Angre» i historikk bekreftet |
| Mørk modus | Meg/Tema → Mørk, sak og utkast: brukeren bekreftet lesbar tekst/beløp/felt/knapper. Ingen instrumentert kontrastmåling |

## Observerte avvik og fortsatt åpne porter

- Google ga reproduserbar 400 «Unsupported provider: provider is not enabled».
  Offentlige testinnstillinger viste googleEnabled=false. Brukeren ønsker
  å utsette dette oppsettet og opplyser at vanlig Medhold-Google fungerer.
  Google i test er derfor blokkert/utsatt, ikke bestått. Telefonlogin er ikke testet.
- Ett skjermbilde fra «Sjekk før du sender» viser «1 kr» i verdioversikten,
  selv om brevet har 1288/1250/38. Mulig uttrekks-/referansefeil, ikke
  konkludert eller rettet i denne dokumentoppdateringen.
- Sakshistorikken viste «beregnet — sjekk brevet» for fristen, selv om
  testteksten og bekreftelseskortet hadde eksplisitt 22. november. Kildemerking
  må undersøkes; riktig dato alene beviser ikke riktig kilde.
- Kamera, bilde/PDF-opplasting på fysisk enhet og faktisk mottakeradresse
  i Mail er ikke testet i denne reisen.
- 200 % sidezoom, stor systemtekst, VoiceOver, reduced motion og fysisk
  flerfane-konflikt er ikke bekreftet ennå. Android/TalkBack mangler fortsatt.
- Eldre app mot oppgradert klone, slutt-smoke etter faktisk integrasjon og
  GitHub-workflow etter separat godkjent merge er fortsatt åpne releaseporter.

Denne rapporten godkjenner ikke privat beta eller produksjonsutrulling.
