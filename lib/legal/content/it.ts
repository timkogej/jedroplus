import { LEGAL_FACTS as F } from '../facts';
import type { LegalContent } from '../types';

const provider = `${F.provider}, ${F.address}, Slovenia, numero di registrazione ${F.registrationNumber}`;

export const it: LegalContent = {
  ui: {
    draftBanner: 'Bozza. Il testo non è ancora stato verificato da un legale e può cambiare.',
    lastUpdated: 'In vigore dal',
    bindingNote: 'Questa è una traduzione. In caso di differenze prevale la versione slovena.',
    otherDocuments: 'Altri documenti',
    languageLabel: 'Lingua',
  },
  docs: {
    // ─────────────────────────────────────────────────────────────────────────
    terms: {
      title: 'Condizioni generali di utilizzo',
      summary:
        "Le condizioni alle quali le imprese utilizzano l'app Jedro+ per prenotazioni, clienti, promemoria, Receptionist+ e altre funzioni.",
      sections: [
        {
          heading: '1. Fornitore',
          blocks: [
            `L'app ${F.product} è fornita da ${provider} (il "Fornitore"). Il responsabile autorizzato del servizio è ${F.representative}. Contatto: ${F.email}.`,
            "Il Fornitore non è soggetto IVA. I prezzi sono finali; l'IVA non è addebitata ai sensi dell'art. 94, comma 1, della legge slovena sull'IVA (ZDDV-1).",
          ],
        },
        {
          heading: '2. A chi è destinato il servizio',
          blocks: [
            `${F.product} è destinato esclusivamente all'uso professionale: società, ditte individuali e altre persone che utilizzano l'app per la propria attività (l'"Utente"). Con la registrazione l'Utente conferma di non utilizzare l'app come consumatore.`,
            "Il Fornitore non verifica se l'attività dell'Utente è registrata. L'Utente è l'unico responsabile di svolgere la propria attività nel rispetto delle norme applicabili (registrazione, imposte, protezione dei dati, tutela dei consumatori, pubblicità).",
            "Dell'account risponde la persona che lo ha creato (titolare). Il titolare può invitare collaboratori e assegnare ruoli e risponde delle loro azioni nell'app come delle proprie.",
          ],
        },
        {
          heading: '3. Contenuto del servizio',
          blocks: [
            'Le funzioni dipendono dal pacchetto scelto e dai componenti aggiuntivi, tra cui:',
            '- calendario, appuntamenti, servizi, personale e risorse;',
            '- anagrafica clienti e storico degli appuntamenti;',
            '- prenotazione online e registrazione autonoma dei clienti tramite link pubblico;',
            '- promemoria e avvisi ai clienti via e-mail e SMS;',
            '- invio di novità e offerte ai clienti (Comunicazione);',
            '- Chatbot+ (chat AI per i clienti) e Receptionist+ (assistente telefonica AI);',
            '- pagamenti online dei clienti tramite Stripe;',
            '- statistiche, promozioni ed esportazioni.',
            'Il Fornitore può migliorare, modificare o sospendere funzioni. Non riduce in modo sostanziale le funzioni a pagamento durante un periodo già pagato senza preavviso.',
          ],
        },
        {
          heading: '4. Registrazione e accesso',
          blocks: [
            "L'Utente deve fornire dati veritieri e aggiornati, custodire le credenziali (password, link di accesso) e informare senza ritardo il Fornitore di qualsiasi abuso.",
            "I codici e i link per unirsi al team danno accesso ai dati dell'impresa; l'Utente li condivide solo con le persone a cui consente l'accesso.",
          ],
        },
        {
          heading: '5. Pacchetti, prezzi e pagamento',
          blocks: [
            "I pacchetti e i prezzi in vigore sono pubblicati nell'app (Impostazioni → Pacchetti). Il pacchetto gratuito include una quantità di prova di messaggi, una tantum, che non si rinnova.",
            "L'abbonamento si paga in anticipo, mensilmente o annualmente, tramite il fornitore di pagamenti Stripe e si rinnova automaticamente fino alla disdetta. I componenti aggiuntivi mensili (SMS, e-mail, utenti aggiuntivi) sono fatturati insieme all'abbonamento.",
            "I crediti per Receptionist+ si acquistano a pacchetti con pagamento una tantum. Alla prima attivazione l'Utente riceve crediti di prova. I crediti non scadono e non sono rimborsabili.",
            "Esaurita la quantità mensile di SMS o e-mail, ulteriori messaggi non vengono inviati fino al rinnovo o all'acquisto di un componente aggiuntivo. Gli SMS sono inviati solo a numeri dei paesi indicati nell'app (attualmente Slovenia, Croazia, Austria, Germania e Italia); agli altri numeri viene inviata un'e-mail.",
            "Il Fornitore può modificare i prezzi, comunicandolo via e-mail con almeno 30 giorni di anticipo; la modifica si applica dal periodo di fatturazione successivo. L'Utente che non è d'accordo può disdire.",
          ],
        },
        {
          heading: '6. Disdetta',
          blocks: [
            "L'Utente può disdire in qualsiasi momento nell'app o tramite il portale Stripe. La disdetta ha effetto alla fine del periodo pagato; fino ad allora il servizio funziona. I pagamenti per il periodo in corso o non utilizzato non sono rimborsati, salvo diversa disposizione di legge.",
            "Il Fornitore può limitare l'accesso o risolvere il contratto se l'Utente non paga gli importi dovuti, viola gravemente o ripetutamente queste condizioni, o se la prosecuzione del servizio violerebbe la legge. Salvo violazioni gravi, avvisa prima l'Utente e gli concede un termine ragionevole per rimediare.",
            `Alla fine del contratto il Fornitore conserva i dati dell'Utente per altri ${F.deletionAfterEndDays} giorni, affinché possa esportarli o rinnovare, e poi li cancella, salvo i dati che deve conservare per legge (ad es. fatture).`,
          ],
        },
        {
          heading: "7. Obblighi dell'Utente",
          blocks: [
            "L'Utente non può usare l'app per scopi illeciti, per inviare messaggi non richiesti, per raccogliere dati di terzi senza base giuridica, per disturbare il servizio o per tentare accessi non autorizzati.",
            "L'Utente è titolare del trattamento dei dati personali dei propri clienti, dipendenti e chiamanti inseriti o raccolti nell'app. Deve disporre di una base giuridica e informare gli interessati. Il Fornitore tratta tali dati come responsabile del trattamento secondo l'Accordo sul trattamento dei dati, parte integrante di queste condizioni.",
            "L'Utente inserisce categorie particolari di dati personali (ad es. dati sanitari) solo con un'adeguata base giuridica e nella misura strettamente necessaria.",
            "Per inviare novità e offerte (Comunicazione) l'Utente deve disporre di una base adeguata (consenso o eccezione per i clienti esistenti). L'app aggiunge a ogni messaggio di questo tipo un link di disiscrizione e non scrive più ai clienti disiscritti.",
            "Receptionist+ registra e trascrive le chiamate. L'avviso di registrazione è attivo per impostazione predefinita; se l'Utente lo disattiva, è l'unico responsabile della liceità della registrazione.",
          ],
        },
        {
          heading: '8. Intelligenza artificiale',
          blocks: [
            "Alcune funzioni (suggerimenti di messaggi, Chatbot+, Receptionist+) utilizzano modelli linguistici e vocali di fornitori terzi. Le risposte sono generate automaticamente e possono essere imprecise o incomplete. L'Utente deve verificare le informazioni importanti (ad es. appuntamenti, prezzi, istruzioni) e configurare le funzioni in modo da non fuorviare i clienti.",
            'Il Fornitore non utilizza i dati dei clienti per addestrare modelli e non consente ai fornitori dei modelli di farlo.',
          ],
        },
        {
          heading: '9. Contenuti e diritti',
          blocks: [
            "I dati e i contenuti inseriti dall'Utente restano suoi. L'Utente concede al Fornitore il diritto di trattarli nella misura necessaria a fornire il servizio.",
            `L'app, il suo codice, il design e il marchio ${F.product} appartengono al Fornitore. L'Utente ottiene un diritto d'uso non esclusivo e non trasferibile per la durata del contratto.`,
          ],
        },
        {
          heading: '10. Disponibilità',
          blocks: [
            'Il Fornitore si impegna a mantenere il servizio attivo senza interruzioni, ma non lo garantisce. Il servizio può essere temporaneamente non disponibile per manutenzione, aggiornamenti o interruzioni di fornitori terzi (hosting, SMS, e-mail, pagamenti, modelli AI). Le manutenzioni programmate più lunghe sono annunciate in anticipo.',
          ],
        },
        {
          heading: '11. Responsabilità',
          blocks: [
            "Il Fornitore risponde dei danni causati con dolo o colpa grave. Per gli altri danni la responsabilità è limitata all'importo pagato dall'Utente al Fornitore nei 12 mesi precedenti il danno.",
            "Il Fornitore non risponde di danni indiretti (ad es. mancato guadagno, appuntamenti persi), di danni dovuti a dati o impostazioni errati dell'Utente, di messaggi non recapitati per cause imputabili a operatori o destinatari, di risposte AI imprecise non verificate dall'Utente, né di interruzioni di fornitori terzi al di fuori del suo controllo.",
            "L'Utente tiene indenne il Fornitore da pretese di terzi derivanti dal suo uso illecito dell'app o dalla violazione di queste condizioni.",
          ],
        },
        {
          heading: '12. Modifiche delle condizioni',
          blocks: [
            "Il Fornitore può modificare queste condizioni. Informa l'Utente delle modifiche sostanziali via e-mail almeno 30 giorni prima dell'entrata in vigore. Se l'Utente continua a usare il servizio dopo tale data, le modifiche si intendono accettate; se non è d'accordo, può disdire prima dell'entrata in vigore.",
          ],
        },
        {
          heading: '13. Legge applicabile e controversie',
          blocks: [
            'Si applica la legge della Repubblica di Slovenia. Le parti cercheranno di risolvere le controversie in via amichevole; in mancanza è competente il tribunale competente di Lubiana.',
            'Le condizioni sono pubblicate in più lingue. In caso di differenze prevale la versione slovena.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    privacy: {
      title: 'Informativa sulla privacy',
      summary:
        "Come Jedro+ tratta i dati personali degli utenti dell'app e come tratta, per conto dei saloni, i dati dei loro clienti.",
      sections: [
        {
          heading: '1. Titolare del trattamento',
          blocks: [
            `Titolare del trattamento dei dati personali degli utenti di ${F.product} è ${provider}. Il referente per la protezione dei dati è ${F.representative}. Contatto per domande e richieste: ${F.email}.`,
            "Per i dati di clienti, dipendenti e chiamanti che le imprese (ad es. saloni) gestiscono nell'app, il titolare è l'impresa stessa; il Fornitore li tratta solo per suo conto (vedi punto 8).",
          ],
        },
        {
          heading: '2. Quali dati trattiamo',
          blocks: [
            "- Dati dell'account: nome, indirizzo e-mail, password (memorizzata come hash), ruolo nel team, lingua dell'app.",
            "- Dati dell'impresa: denominazione, settore, indirizzo, paese, partita IVA/codice fiscale, telefono ed e-mail di contatto, logo, orari, impostazioni.",
            '- Dati di abbonamento e pagamento: pacchetto, componenti aggiuntivi, consumo di messaggi, fatture. I dati delle carte sono trattati da Stripe; il Fornitore non li vede.',
            '- Dati tecnici: indirizzo IP e ora delle richieste (per sicurezza e prevenzione degli abusi), log degli errori del server.',
            "- Comunicazioni: messaggi che l'Utente invia al Fornitore (ad es. richieste, assistenza).",
          ],
        },
        {
          heading: '3. Finalità e basi giuridiche',
          blocks: [
            "- Esecuzione del contratto (art. 6, par. 1, lett. b GDPR): creazione dell'account, fornitura delle funzioni, fatturazione, assistenza, avvisi di servizio (ad es. quota esaurita, pagamento non riuscito).",
            '- Obblighi di legge (art. 6, par. 1, lett. c GDPR): conservazione di fatture e documenti contabili.',
            '- Legittimo interesse (art. 6, par. 1, lett. f GDPR): sicurezza e prevenzione degli abusi, correzione di errori, miglioramento del servizio sulla base di statistiche aggregate e non personali.',
            'Non vendiamo i dati e non li usiamo per la pubblicità di terzi.',
          ],
        },
        {
          heading: '4. Per quanto tempo conserviamo i dati',
          blocks: [
            `- Dati dell'account e dell'impresa: per la durata del contratto e ${F.deletionAfterEndDays} giorni dopo la sua fine, poi vengono cancellati.`,
            '- Fatture e documenti contabili: per il tempo previsto dalla legge (10 anni per le fatture).',
            '- Dati tecnici per la prevenzione degli abusi: a breve termine; log degli errori: al massimo 30 giorni.',
          ],
        },
        {
          heading: '5. A chi comunichiamo i dati',
          blocks: [
            'I dati sono trattati da responsabili accuratamente selezionati (hosting, database, e-mail, SMS, pagamenti, telefonia, modelli AI) con cui sono stipulati accordi sul trattamento. L\'elenco è pubblicato nella pagina "Sub-responsabili".',
            'Possiamo comunicare i dati alle autorità pubbliche quando la legge lo richiede.',
          ],
        },
        {
          heading: "6. Trasferimenti fuori dall'UE",
          blocks: [
            "Database, hosting dell'app, e-mail e server di automazione si trovano nell'UE. Alcuni fornitori (modelli AI linguistici e vocali, telefonia, parte del sistema di pagamento) trattano i dati anche negli Stati Uniti. I trasferimenti sono tutelati dalle clausole contrattuali tipo della Commissione europea e, ove il fornitore aderisca, dal Data Privacy Framework UE-USA.",
          ],
        },
        {
          heading: '7. Cookie',
          blocks: [
            "L'app utilizza solo cookie tecnici e archiviazione locale: per l'accesso (sessione), la lingua scelta e l'impresa scelta. Non utilizziamo cookie analitici, pubblicitari o di tracciamento, quindi non è necessario il consenso ai cookie.",
          ],
        },
        {
          heading: '8. Dati dei clienti dei saloni',
          blocks: [
            "Se sei cliente di un'impresa che usa Jedro+ (ad es. un salone), i tuoi dati sono gestiti da quell'impresa. Il Fornitore li tratta solo secondo le sue istruzioni, per prenotazioni, promemoria, avvisi e le altre funzioni utilizzate. Per esercitare i tuoi diritti rivolgiti direttamente all'impresa; il Fornitore la assisterà.",
            '- Possono essere trattati: nome e cognome, e-mail, numero di telefono, genere, lingua, note, storico degli appuntamenti, pagamenti, consenso alle comunicazioni.',
            '- Novità e offerte: ogni messaggio di questo tipo contiene un link di disiscrizione. Dopo la disiscrizione non li riceverai più; i promemoria degli appuntamenti continuano a essere inviati.',
            `- Chiamate a Receptionist+: la chiamata viene registrata e trascritta affinché l'assistente AI possa prenotare un appuntamento o inoltrare un messaggio. Ne sei informato all'inizio della chiamata. Registrazioni e trascrizioni sono conservate per ${F.callRetentionDays} giorni.`,
            `- Il registro degli SMS inviati (numero, ora, stato di consegna) è conservato per ${F.smsLogRetentionMonths} mesi.`,
          ],
        },
        {
          heading: '9. Processi decisionali automatizzati',
          blocks: [
            'Le funzioni AI preparano risposte e suggerimenti, ma non prendono decisioni con effetti giuridici o analogamente significativi sulle persone.',
          ],
        },
        {
          heading: '10. Sicurezza',
          blocks: [
            "I dati sono cifrati durante la trasmissione (HTTPS/TLS) e conservati presso fornitori certificati. L'accesso è limitato da ruoli e regole a livello di database; i dati di ogni impresa sono separati. Vi accede solo una persona autorizzata del Fornitore, quando necessario per il funzionamento o l'assistenza.",
          ],
        },
        {
          heading: '11. I tuoi diritti',
          blocks: [
            `Hai diritto di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Invia le richieste a ${F.email}; rispondiamo entro un mese.`,
            "Puoi presentare reclamo al Garante sloveno (Informacijski pooblaščenec), Dunajska cesta 22, 1000 Ljubljana, www.ip-rs.si, o all'autorità di controllo del tuo paese (in Italia: Garante per la protezione dei dati personali).",
          ],
        },
        {
          heading: '12. Modifiche',
          blocks: [
            "Possiamo aggiornare questa informativa. Informiamo gli utenti delle modifiche sostanziali via e-mail; la data di entrata in vigore è indicata in alto.",
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    dpa: {
      title: 'Accordo sul trattamento dei dati',
      summary:
        "Accordo ai sensi dell'art. 28 GDPR tra l'impresa che usa Jedro+ (titolare) e il Fornitore (responsabile). È parte integrante delle Condizioni generali di utilizzo e si applica con la loro accettazione.",
      sections: [
        {
          heading: '1. Parti',
          blocks: [
            "- Titolare: la società o ditta individuale che ha accettato le Condizioni generali di utilizzo di Jedro+ (l'\"Utente\").",
            `- Responsabile: ${provider}, persona autorizzata ${F.representative}, ${F.email} (il "Fornitore").`,
          ],
        },
        {
          heading: '2. Oggetto e durata',
          blocks: [
            "Il Fornitore tratta dati personali per conto dell'Utente esclusivamente per fornire l'app Jedro+ nei limiti delle funzioni utilizzate. L'accordo vale finché vale il contratto di utilizzo e fino alla cancellazione dei dati dopo la sua fine.",
          ],
        },
        {
          heading: '3. Natura e finalità del trattamento',
          blocks: [
            'Conservazione, organizzazione, visualizzazione, invio di messaggi (e-mail, SMS), ricezione e trascrizione di chiamate, preparazione di risposte con modelli AI, gestione di pagamenti online, esportazione e cancellazione — per la gestione di appuntamenti e clienti, promemoria, avvisi, messaggi di marketing, prenotazione online, Chatbot+ e Receptionist+.',
          ],
        },
        {
          heading: '4. Tipi di dati e interessati',
          blocks: [
            "- Clienti dell'Utente: nome, cognome, e-mail, telefono, genere, lingua, note, tipo di cliente, storico appuntamenti, servizi, prezzi e sconti, stato dei pagamenti, consenso alle comunicazioni e disiscrizione.",
            '- Chiamanti (Receptionist+): numero di telefono, registrazione e trascrizione della conversazione, esito della chiamata.',
            '- Visitatori della chat (Chatbot+): contenuto della conversazione e dati inseriti.',
            "- Dipendenti dell'Utente: nome, contatto, turni, assenze, appuntamenti assegnati.",
            "Le categorie particolari di dati sono trattate solo se l'Utente le inserisce (ad es. nelle note); l'Utente garantisce una base giuridica e le limita al necessario.",
          ],
        },
        {
          heading: '5. Obblighi del Fornitore',
          blocks: [
            "- Tratta i dati solo su istruzioni documentate dell'Utente, impartite tramite l'uso e le impostazioni dell'app, e lo informa se ritiene un'istruzione illecita.",
            '- Vincola alla riservatezza le persone che hanno accesso ai dati.',
            '- Attua le misure tecniche e organizzative di cui al punto 7.',
            "- Assiste l'Utente nel rispondere alle richieste degli interessati (accesso, rettifica, cancellazione, esportazione) e negli obblighi degli artt. da 32 a 36 GDPR.",
            "- Notifica all'Utente una violazione dei dati personali senza ingiustificato ritardo e comunque entro 48 ore dalla conoscenza, con tutte le informazioni disponibili.",
            '- Fornisce su richiesta le informazioni necessarie a dimostrare la conformità e consente verifiche ragionevoli (di norma tramite documentazione e risposte scritte).',
          ],
        },
        {
          heading: '6. Sub-responsabili',
          blocks: [
            'L\'Utente autorizza in via generale i sub-responsabili elencati nella pagina "Sub-responsabili". Il Fornitore vincola ciascuno agli stessi obblighi di protezione dei dati e ne risponde come per sé.',
            "Il Fornitore informa l'Utente di nuovi o sostituiti sub-responsabili con almeno 30 giorni di anticipo (via e-mail o nell'app). L'Utente può opporsi per motivi fondati; se non si trova una soluzione, può recedere senza costi.",
            'I trasferimenti verso paesi terzi avvengono solo con garanzie adeguate (clausole contrattuali tipo, Data Privacy Framework UE-USA).',
          ],
        },
        {
          heading: '7. Misure tecniche e organizzative',
          blocks: [
            '- Cifratura in transito (TLS) e cifratura dei dati memorizzati presso il fornitore del database.',
            "- Database, hosting, e-mail e server di automazione nell'UE.",
            '- Separazione dei dati per impresa; regole di accesso a livello di database (RLS); scrittura dei dati solo tramite percorsi server verificati.',
            '- Accesso basato sui ruoli (titolare, amministratore, dipendente) e principio del privilegio minimo; chiavi segrete solo sul server.',
            '- Limitazione delle richieste e protezione dagli abusi; link firmati (ad es. per la disiscrizione).',
            '- Backup regolari presso il fornitore del database; registrazione delle modifiche ad appuntamenti e clienti.',
            '- Cancellazione automatica delle registrazioni delle chiamate dopo 90 giorni e dei dati dopo la fine del contratto.',
          ],
        },
        {
          heading: "8. Obblighi dell'Utente",
          blocks: [
            '- Dispone di una base giuridica per il trattamento dei dati di clienti, dipendenti e chiamanti e li informa (ad es. nella propria informativa privacy).',
            '- Invia messaggi di marketing solo ai clienti per cui ha una base e rispetta le disiscrizioni.',
            "- Mantiene attivo l'avviso di registrazione di Receptionist+ o garantisce autonomamente la liceità della registrazione.",
            "- Concede l'accesso all'app solo a chi ne ha bisogno e lo revoca tempestivamente.",
          ],
        },
        {
          heading: '9. Fine del trattamento',
          blocks: [
            `Dopo la fine del contratto l'Utente può esportare i dati. Il Fornitore li cancella ${F.deletionAfterEndDays} giorni dopo la fine, comprese le copie presso i sub-responsabili nei tempi dei loro backup, salvo obblighi di conservazione di legge.`,
          ],
        },
        {
          heading: '10. Disposizioni finali',
          blocks: [
            'Per la responsabilità valgono le Condizioni generali di utilizzo, salvo diversa disposizione del GDPR. Si applica la legge della Repubblica di Slovenia. In caso di differenze tra versioni linguistiche prevale quella slovena.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    subprocessors: {
      title: 'Sub-responsabili',
      summary:
        'Fornitori terzi che trattano dati personali per Jedro+. Annunciamo le modifiche con 30 giorni di anticipo.',
      sections: [
        {
          heading: 'Infrastruttura (UE)',
          blocks: [
            '- Supabase — database, accesso e archiviazione file — UE (Stoccolma, Svezia)',
            "- Vercel — hosting dell'app — UE (Stoccolma, Svezia)",
            '- Hetzner Online — server di automazione (n8n) — UE',
            '- Upstash — limitazione delle richieste (indirizzi IP, a breve termine) — UE (Francoforte, Germania)',
          ],
        },
        {
          heading: 'Messaggi',
          blocks: [
            '- Amazon Web Services (Amazon SES) — invio e-mail — UE (Stoccolma, Svezia)',
            '- BulkGate — invio SMS — UE (Repubblica Ceca)',
          ],
        },
        {
          heading: 'Pagamenti',
          blocks: [
            '- Stripe — abbonamenti, acquisto crediti e pagamenti online dei clienti — UE (Irlanda), in parte USA',
          ],
        },
        {
          heading: 'Receptionist+ e funzioni AI',
          blocks: [
            '- Telnyx — numeri di telefono e trasporto delle chiamate — USA e rete globale',
            '- Soniox — riconoscimento vocale (trascrizione delle chiamate) — USA',
            "- ElevenLabs — sintesi vocale (voce dell'assistente) — USA",
            '- Anthropic (Claude) — modello linguistico per conversazioni e suggerimenti di messaggi — USA',
            '- OpenAI — modello linguistico per conversazioni e suggerimenti di messaggi — USA',
            'Per i fornitori negli USA i trasferimenti sono tutelati da clausole contrattuali tipo e, ove il fornitore aderisca, dal Data Privacy Framework UE-USA. I fornitori di modelli AI non usano i dati per addestrare modelli.',
          ],
        },
      ],
    },
  },
};
