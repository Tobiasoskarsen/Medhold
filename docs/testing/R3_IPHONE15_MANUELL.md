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
| Safari-sidezoom 200 % | Brukeren bekreftet at innhold og handlinger fortsatt fungerte. Dette beviser ikke stor iOS-systemtekst |
| Bilde- og PDF-opplasting | Brukeren testet ett bilde og én PDF hver for seg i oppdatert preview og svarte «Begge fungerer» på lesing, bekreftelse og lagring uten stopp. Kamerakilde/format/størrelse er ikke oppgitt |
| Direkte kameraopptak | Brukeren tok et nytt bilde av et testbrev via kamera i Safari og bekreftet «Hele kameraflyten fungerer» gjennom lesing, bekreftelse og lagring. Ingen instrumentert måling av format/størrelse |

## Fanebytte med redusert bevegelse – fysisk retest bestått

Brukeren bekreftet funksjonene med «Reduser bevegelse», men rapporterte et
kort svart glimt mellom Medholds faner, og presiserte at det bare skjedde
inne i appen. Etter rettelsen f760eef i oppdatert test-preview svarte brukeren
«Ja, glimtet er borte» på retest av Hjem/Saker/Meg med redusert bevegelse på.
Dette avviket er dermed brukerbekreftet rettet på iPhone 15/Safari.

Kodegjennomgangen fant at template alltid startet med opacity:0, at Sekvens
fortsatt tonet inn under redusert bevegelse, og at Skjermramme beholdt skjulte
stagger-barn. Disse tre innholdsrammene viser nå innholdet straks ved redusert
bevegelse. En avgrenset mediaregel sikrer synlighet også i serverrendret HTML
før hydrering. Vanlig animasjon og eksisterende delte overganger beholdes.

Fem komponentregresjoner dekker redusert/vanlig bevegelse, delt overgang og
SSR-markering. De tre feiltilfellene feilet før rettelsen. Lokal headless
Chrome med ekte serverrendring fra React/Motion og appens CSS viste alle tre
rammer med computed opacity:1 og transform:none før hydrering når media-valget
var reduce. Dette var en isolert UI-prøve uten innlogging, ikke Safari eller
en full navigasjonsprøve. Den etterfølgende fysiske retesten over bekreftet
at det rapporterte glimtet var borte; dette beviser ikke alle andre overganger.

Sluttkontroll: `npm test` 389/389, `npm run test:db` 95/95 (inkludert fem nye
regresjoner), `npm run lint`, `npx tsc --noEmit` og `npm run build` grønne.
Første lokale forsøk fikk EPERM ved filtilgang og Turbopack-underprosessfeil;
DB-testene passerte uten sandbox og bygget passerte etter tømming av kun den
genererte `.next`-mappen. Ingen tester eller byggkontroller ble svekket.

## Observerte avvik og fortsatt åpne porter

Systemtekst: brukeren økte iPhones tekststørrelse og rapporterte «den endret
seg ikke». Kodekontroll viste faste px-størrelser i appens typografi. Dette
beviser ikke støtte for systemtekst og er ikke markert bestått. Den tidligere
brukerbekreftede prøven med 200 % Safari-sidezoom er et separat resultat.

VoiceOver: brukeren presiserte «jo voiceover funka jo fint» etter prøven på
iPhone. Den avgrensede prøven er derfor brukerbekreftet bestått, ikke utestet.
Opplesingen av «Meg, besøkt, lenke slutt, navigering» ble rapportert; ingen
konkret appfeil ble meldt. Dette er ikke en full VoiceOver-audit av alle flyter.

- Google ga reproduserbar 400 «Unsupported provider: provider is not enabled».
  Offentlige testinnstillinger viste googleEnabled=false. Brukeren ønsker
  å utsette dette oppsettet og opplyser at vanlig Medhold-Google fungerer.
  Google i test er derfor blokkert/utsatt, ikke bestått. Telefonlogin er ikke testet.
- Ett skjermbilde fra «Sjekk før du sender» viser «1 kr» i verdioversikten,
  selv om brevet har 1288/1250/38. Senere gjenskapt og rettet: kort saksreferanse
  ble tolket som beløp. Regresjon og desktop-browserprøve bestått; se R3_SLUTTKONTROLL.md.
- Sakshistorikken viste «beregnet — sjekk brevet» for fristen, selv om
  testteksten og bekreftelseskortet hadde eksplisitt 22. november. Kildemerking
  er senere rettet i klient/server og visning med lagret dokumentbevis.
  Regresjon og desktop-browserprøve bestått; se R3_SLUTTKONTROLL.md.
- Bilde- og PDF-opplasting på fysisk enhet er senere brukerbekreftet bestått
  (se tabellen). Direkte kameraopptak er også senere bekreftet bestått.
  Faktisk mottakeradresse i Mail er ikke særskilt bekreftet i denne reisen.
- Stor systemtekst og fysisk flerfane-konflikt er ikke bekreftet
  ennå. Fanebytte med redusert bevegelse er retestet over; Android/TalkBack
  mangler fortsatt.
- Eldre app mot oppgradert klone, slutt-smoke etter faktisk integrasjon og
  GitHub-workflow etter separat godkjent merge er fortsatt åpne releaseporter.
  Fire avgrensede eldre servermodul-prøver mot oppgradert testprosjekt er senere
  bestått, men erstatter ikke en full historisk browserapp/klone.

Denne rapporten godkjenner ikke privat beta eller produksjonsutrulling.
