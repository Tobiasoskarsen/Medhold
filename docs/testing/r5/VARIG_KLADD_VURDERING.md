# Vurdering: varig uferdig brevkontroll – ikke implementert

Nivå 1 (gjenfinning av lagrede brev) og nivå 2 (React-tilstand og navigasjonsvern) er tilstrekkelig for R5. Uferdig brevkontroll etter OS-lukking kan være nyttig, men krever separat beslutning.

Eventuelt forslag: serverlagre bare eksplisitt valgte, nødvendige felt etter brukerens samtykke; ikke råbilder eller OCR som standard. Egen kladd med eier-ID, kort utløpstid (foreslått 24 timer), sist endret og eksplisitt Slett. RLS på alle operasjoner, ingen service-role fra klient. Kontoavslutning må kaskadeslette; utlogging må skjule/avbryte klienttilgang. Avklar automatisk utløpsjobb, sletting hos modell-/lagringsleverandør og oppdatert personverninformasjon før bygging.

Delt enhet: autentisering er ikke nok dersom økten står åpen; krev tydelig avslutt/utlogging. Nettleserkryptering med nøkkel i samme JavaScript-kontekst beskytter ikke mot XSS eller åpnet økt og rettferdiggjør ikke localStorage. Serverkryptering beskytter andre angrep, men endrer ikke behovet for tilgangskontroll, dataminimering og slettefrister.

Kladd er aldri et bekreftet brev, ingen påminnelse/saksstatus før atomisk lagre_brev er utført. Ved eksplisitt fullføring må eksisterende idempotens nøkkelbruk og transaksjon beholdes, og kladden merkes fullført uten dobbelt brev ved retry. Ny tabell/migrasjon, oppbevaringsmekanisme og juridisk personvernvurdering er utenfor R5 og krever særskilt godkjenning.
