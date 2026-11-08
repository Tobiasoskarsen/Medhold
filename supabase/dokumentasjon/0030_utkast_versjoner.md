# S1-C: utkastlagring (0030)

Ikke kjørt i Supabase. Krever separat godkjenning og testmiljø før produksjon.

Legger til versjon, vaktfakta og en uforanderlig sendt-tekst på eksisterende
utkast. Ingen gamle tekster endres. Gamle sendt-utkast får ingen oppdiktet
sluttversjon: UI merker at eksakt sendt tekst ikke er dokumentert.

Triggeren øker versjonen ved UPDATE. Klientlagring krever forventet versjon,
eierskap, sak og ikke-sendt status. Serveren maskerer fødselsnummer og returnerer
teksten som faktisk ble lagret. Ingen AI-kall ved lagring.

`registrer_utkast_sendt` låser utkastet, kontrollerer eier/versjon, tar kopi av
gjeldende tekst og oppdaterer aktiv sak til venter i én transaksjon. Den sender
ikke e-post. RLS gjelder (security invoker). Sendt tekst/tid kan ikke endres.

Utrulling: test 0030 på separat testdatabase etter 0029, test gammel data og
to faner, deretter godkjenn migrasjon før kode. Ingen kodeutrulling før kolonner
og RPC finnes. Tilbakeføring: rull kode tilbake først; behold kolonnene og
snapshotdataene fremfor å slette brukerens bevarte tekst.

Valgt strategi er eksplisitt «Lagre endringer», synlig status og retry. Kopier,
e-post og sendt-registrering sperres til endringen er serverbekreftet. Refresh
og lenkenavigasjon varsler om ulagret tekst. En bruker-/utkastbundet
sessionStorage-buffer med maskert tekst kan gjenopprette arbeid i samme fane,
også etter SPA-tilbake. Den er ikke serverlagring og kan være utilgjengelig.

Åpning: `?utkast=<id>` hentes innenfor riktig sak og bruker. Historikken og
utkastsiden tilbyr lenker. Ferdigmarkøren fra strømmen bærer autoritativ tekst
og versjon; klienten erstatter strømvisningen før kopiering blir tilgjengelig.

Lokale tester dekker versjonskonflikt, annen bruker, snapshot, gjentatt migrasjon
og atomisk statusoppdatering. Ekte parallelle forbindelser og live PostgREST
gjenstår. PGlite er ikke bevis på produksjonsoppsett.
