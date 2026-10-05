import { LEGAL_FACTS as F } from '../facts';
import type { LegalContent } from '../types';

const provider = `${F.provider}, ${F.address}, Slowenien, Registernummer ${F.registrationNumber}`;

export const de: LegalContent = {
  ui: {
    draftBanner: 'Entwurf. Dieser Text wurde noch nicht rechtlich geprüft und kann sich ändern.',
    lastUpdated: 'Gültig ab',
    bindingNote: 'Dies ist eine Übersetzung. Bei Abweichungen gilt die slowenische Fassung.',
    otherDocuments: 'Weitere Dokumente',
    languageLabel: 'Sprache',
  },
  docs: {
    // ─────────────────────────────────────────────────────────────────────────
    terms: {
      title: 'Allgemeine Nutzungsbedingungen',
      summary:
        'Die Bedingungen, unter denen Unternehmen die App Jedro+ für Buchungen, Kunden, Erinnerungen, Receptionist+ und weitere Funktionen nutzen.',
      sections: [
        {
          heading: '1. Anbieter',
          blocks: [
            `Die App ${F.product} wird bereitgestellt von ${provider} (der „Anbieter“). Für den Dienst bevollmächtigt und verantwortlich ist ${F.representative}. Kontakt: ${F.email}.`,
            'Der Anbieter ist nicht umsatzsteuerpflichtig. Die Preise sind Endpreise; gemäß Art. 94 Abs. 1 des slowenischen Umsatzsteuergesetzes (ZDDV-1) wird keine Umsatzsteuer berechnet.',
          ],
        },
        {
          heading: '2. Für wen der Dienst bestimmt ist',
          blocks: [
            `${F.product} ist ausschließlich für die geschäftliche Nutzung bestimmt: für Unternehmen, Einzelunternehmer und andere Personen, die die App für ihre berufliche Tätigkeit nutzen (der „Nutzer“). Mit der Registrierung bestätigt der Nutzer, die App nicht als Verbraucher zu nutzen.`,
            'Der Anbieter prüft nicht, ob die Tätigkeit des Nutzers angemeldet ist. Der Nutzer ist allein dafür verantwortlich, seine Tätigkeit im Einklang mit den für ihn geltenden Vorschriften auszuüben (Gewerbeanmeldung, Steuern, Datenschutz, Verbraucherschutz, Werbung).',
            'Für das Konto verantwortlich ist die Person, die es angelegt hat (Inhaber). Der Inhaber kann Mitarbeitende einladen und ihnen Rollen zuweisen und haftet für deren Handeln in der App wie für eigenes.',
          ],
        },
        {
          heading: '3. Leistungsumfang',
          blocks: [
            'Der Funktionsumfang hängt vom gewählten Paket und von Zusatzleistungen ab, unter anderem:',
            '- Kalender, Termine, Leistungen, Mitarbeitende und Ressourcen;',
            '- Kundenverwaltung und Terminhistorie;',
            '- Online-Buchung und Selbstregistrierung von Kunden über einen öffentlichen Link;',
            '- Erinnerungen und Benachrichtigungen an Kunden per E-Mail und SMS;',
            '- Versand von Neuigkeiten und Angeboten an Kunden (Kommunikation);',
            '- Chatbot+ (KI-Chat für Kunden) und Receptionist+ (KI-Telefonassistentin);',
            '- Online-Zahlungen von Kunden über Stripe;',
            '- Auswertungen, Aktionen und Exporte.',
            'Der Anbieter kann Funktionen verbessern, ändern oder einstellen. Wesentliche Einschränkungen bezahlter Funktionen führt er während eines bereits bezahlten Zeitraums nicht ohne vorherige Ankündigung ein.',
          ],
        },
        {
          heading: '4. Registrierung und Zugang',
          blocks: [
            'Der Nutzer muss wahrheitsgemäße Angaben machen und aktuell halten, Zugangsdaten (Passwörter, Anmeldelinks) schützen und den Anbieter unverzüglich über jeden Missbrauch informieren.',
            'Beitrittscodes und -links für das Team gewähren Zugriff auf die Unternehmensdaten; der Nutzer gibt sie nur an Personen weiter, denen er Zugriff gewähren will.',
          ],
        },
        {
          heading: '5. Pakete, Preise und Zahlung',
          blocks: [
            'Die aktuellen Pakete und Preise sind in der App veröffentlicht (Einstellungen → Pakete). Das kostenlose Paket enthält ein einmaliges Test-Kontingent an Nachrichten, das sich nicht erneuert.',
            'Das Abonnement wird im Voraus monatlich oder jährlich über den Zahlungsanbieter Stripe bezahlt und verlängert sich automatisch, bis es gekündigt wird. Monatliche Zusatzleistungen (SMS, E-Mail, zusätzliche Nutzer) werden mit dem Abonnement abgerechnet.',
            'Credits für Receptionist+ werden in Paketen gegen Einmalzahlung gekauft. Bei der ersten Aktivierung erhält der Nutzer Test-Credits. Credits verfallen nicht und werden nicht erstattet.',
            'Ist das monatliche SMS- oder E-Mail-Kontingent aufgebraucht, werden bis zur Erneuerung oder zum Kauf einer Zusatzleistung keine weiteren Nachrichten versendet. SMS werden nur an Nummern aus den in der App genannten Ländern versendet (derzeit Slowenien, Kroatien, Österreich, Deutschland und Italien); andere Nummern erhalten E-Mails.',
            'Der Anbieter kann die Preise ändern. Er kündigt Änderungen mindestens 30 Tage im Voraus per E-Mail an; sie gelten ab dem nächsten Abrechnungszeitraum. Ist der Nutzer nicht einverstanden, kann er kündigen.',
          ],
        },
        {
          heading: '6. Kündigung',
          blocks: [
            'Der Nutzer kann jederzeit in der App oder über das Stripe-Portal kündigen. Die Kündigung wird zum Ende des bezahlten Zeitraums wirksam; bis dahin bleibt der Dienst verfügbar. Zahlungen für den laufenden oder ungenutzten Zeitraum werden nicht erstattet, sofern das Gesetz nichts anderes vorschreibt.',
            'Der Anbieter kann den Zugang beschränken oder den Vertrag kündigen, wenn der Nutzer fällige Beträge nicht zahlt, schwerwiegend oder wiederholt gegen diese Bedingungen verstößt oder die weitere Bereitstellung gegen Vorschriften verstoßen würde. Außer bei schwerwiegenden Verstößen mahnt er den Nutzer zuvor ab und setzt eine angemessene Frist zur Abhilfe.',
            `Nach Vertragsende bewahrt der Anbieter die Daten des Nutzers noch ${F.deletionAfterEndDays} Tage auf, damit dieser sie exportieren oder das Abonnement erneuern kann, und löscht sie anschließend, mit Ausnahme von Daten, die gesetzlich aufzubewahren sind (z. B. Rechnungen).`,
          ],
        },
        {
          heading: '7. Pflichten des Nutzers',
          blocks: [
            'Der Nutzer darf die App nicht für rechtswidrige Zwecke, für unerwünschte Nachrichten, zur Erhebung von Daten Dritter ohne Rechtsgrundlage, zur Störung des Dienstes oder für Versuche unbefugten Zugriffs nutzen.',
            'Der Nutzer ist Verantwortlicher für die personenbezogenen Daten seiner Kunden, Mitarbeitenden und Anrufer, die er in der App erfasst. Er benötigt dafür eine Rechtsgrundlage und muss die Betroffenen informieren. Der Anbieter verarbeitet diese Daten als Auftragsverarbeiter gemäß dem Auftragsverarbeitungsvertrag, der Bestandteil dieser Bedingungen ist.',
            'Besondere Kategorien personenbezogener Daten (z. B. Gesundheitsdaten) erfasst der Nutzer nur mit geeigneter Rechtsgrundlage und nur im unbedingt erforderlichen Umfang.',
            'Für den Versand von Neuigkeiten und Angeboten (Kommunikation) benötigt der Nutzer eine geeignete Grundlage (Einwilligung oder Ausnahme für Bestandskunden). Die App fügt jeder solchen Nachricht einen Abmeldelink hinzu und schreibt abgemeldete Kunden nicht mehr an.',
            'Receptionist+ zeichnet Anrufe auf und transkribiert sie. Der Hinweis auf die Aufzeichnung ist standardmäßig aktiviert; deaktiviert der Nutzer ihn, ist er allein für die Rechtmäßigkeit der Aufzeichnung verantwortlich.',
          ],
        },
        {
          heading: '8. Künstliche Intelligenz',
          blocks: [
            'Einige Funktionen (Nachrichtenvorschläge, Chatbot+, Receptionist+) nutzen Sprach- und Stimmmodelle externer Anbieter. Antworten werden automatisch erzeugt und können ungenau oder unvollständig sein. Der Nutzer muss wichtige Angaben (z. B. Termine, Preise, Hinweise) prüfen und die Funktionen so einrichten, dass Kunden nicht irregeführt werden.',
            'Der Anbieter verwendet Kundendaten nicht zum Training von Modellen und gestattet dies auch den Modellanbietern nicht.',
          ],
        },
        {
          heading: '9. Inhalte und Rechte',
          blocks: [
            'Vom Nutzer erfasste Daten und Inhalte bleiben seine. Er räumt dem Anbieter das Recht ein, sie im für die Erbringung des Dienstes erforderlichen Umfang zu verarbeiten.',
            `Die App, ihr Code, ihr Design und die Marke ${F.product} gehören dem Anbieter. Der Nutzer erhält für die Vertragsdauer ein nicht ausschließliches, nicht übertragbares Nutzungsrecht.`,
          ],
        },
        {
          heading: '10. Verfügbarkeit',
          blocks: [
            'Der Anbieter bemüht sich um einen unterbrechungsfreien Betrieb, garantiert ihn jedoch nicht. Der Dienst kann wegen Wartung, Aktualisierungen oder Ausfällen externer Anbieter (Hosting, SMS, E-Mail, Zahlungen, KI-Modelle) vorübergehend nicht verfügbar sein. Längere geplante Wartungen werden vorab angekündigt.',
          ],
        },
        {
          heading: '11. Haftung',
          blocks: [
            'Der Anbieter haftet für vorsätzlich oder grob fahrlässig verursachte Schäden. Für sonstige Schäden ist die Haftung auf den Betrag beschränkt, den der Nutzer dem Anbieter in den 12 Monaten vor Schadenseintritt gezahlt hat.',
            'Der Anbieter haftet nicht für mittelbare Schäden (z. B. entgangenen Gewinn, ausgefallene Termine), für Schäden aufgrund fehlerhafter Daten oder Einstellungen des Nutzers, für nicht zugestellte Nachrichten aus Gründen bei Netzbetreibern oder Empfängern, für vom Nutzer nicht geprüfte ungenaue KI-Antworten sowie für Ausfälle externer Anbieter außerhalb seines Einflusses.',
            'Der Nutzer stellt den Anbieter von Ansprüchen Dritter frei, die aus seiner rechtswidrigen Nutzung der App oder einem Verstoß gegen diese Bedingungen entstehen.',
          ],
        },
        {
          heading: '12. Änderungen der Bedingungen',
          blocks: [
            'Der Anbieter kann diese Bedingungen ändern. Über wesentliche Änderungen informiert er den Nutzer mindestens 30 Tage vor Inkrafttreten per E-Mail. Nutzt der Nutzer den Dienst danach weiter, gelten die Änderungen als angenommen; ist er nicht einverstanden, kann er vor Inkrafttreten kündigen.',
          ],
        },
        {
          heading: '13. Recht und Streitigkeiten',
          blocks: [
            'Es gilt das Recht der Republik Slowenien. Die Parteien bemühen sich um eine gütliche Einigung; andernfalls ist das zuständige Gericht in Ljubljana zuständig.',
            'Die Bedingungen werden in mehreren Sprachen veröffentlicht. Bei Abweichungen gilt die slowenische Fassung.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    privacy: {
      title: 'Datenschutzerklärung',
      summary:
        'Wie Jedro+ die personenbezogenen Daten der App-Nutzer verarbeitet und wie es Kundendaten von Salons in deren Auftrag verarbeitet.',
      sections: [
        {
          heading: '1. Verantwortlicher',
          blocks: [
            `Verantwortlicher für die personenbezogenen Daten der Nutzer von ${F.product} ist ${provider}. Für den Datenschutz zuständig ist ${F.representative}. Kontakt für alle Fragen und Anfragen: ${F.email}.`,
            'Für die Daten von Kunden, Mitarbeitenden und Anrufern, die Unternehmen (z. B. Salons) in der App führen, ist das jeweilige Unternehmen Verantwortlicher; der Anbieter verarbeitet sie nur in dessen Auftrag (siehe Abschnitt 8).',
          ],
        },
        {
          heading: '2. Welche Daten wir verarbeiten',
          blocks: [
            '- Kontodaten: Name, E-Mail-Adresse, Passwort (als Hashwert gespeichert), Rolle im Team, App-Sprache.',
            '- Unternehmensdaten: Name, Branche, Adresse, Land, Steuernummer, Kontakttelefon und E-Mail, Logo, Öffnungszeiten, Einstellungen.',
            '- Abonnement- und Zahlungsdaten: Paket, Zusatzleistungen, Nachrichtenverbrauch, Rechnungen. Kartendaten verarbeitet Stripe; der Anbieter sieht sie nicht.',
            '- Technische Daten: IP-Adresse und Zeitpunkt von Anfragen (für Sicherheit und Missbrauchsschutz), Fehlerprotokolle des Servers.',
            '- Kommunikation: Nachrichten, die der Nutzer an den Anbieter sendet (z. B. Anfragen, Support).',
          ],
        },
        {
          heading: '3. Zwecke und Rechtsgrundlagen',
          blocks: [
            '- Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO): Kontoerstellung, Bereitstellung der Funktionen, Abrechnung, Support, Dienstmitteilungen (z. B. Kontingent aufgebraucht, fehlgeschlagene Zahlung).',
            '- Rechtliche Verpflichtungen (Art. 6 Abs. 1 lit. c DSGVO): Aufbewahrung von Rechnungen und Buchhaltungsunterlagen.',
            '- Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO): Sicherheit und Missbrauchsschutz, Fehlerbehebung, Verbesserung des Dienstes anhand zusammengefasster, nicht personenbezogener Statistiken.',
            'Wir verkaufen keine Daten und nutzen sie nicht für Werbung Dritter.',
          ],
        },
        {
          heading: '4. Speicherdauer',
          blocks: [
            `- Konto- und Unternehmensdaten: während der Vertragslaufzeit und ${F.deletionAfterEndDays} Tage danach, anschließend werden sie gelöscht.`,
            '- Rechnungen und Buchhaltungsunterlagen: solange gesetzlich vorgeschrieben (Rechnungen 10 Jahre).',
            '- Technische Daten zum Missbrauchsschutz: kurzfristig; Fehlerprotokolle: höchstens 30 Tage.',
          ],
        },
        {
          heading: '5. Empfänger',
          blocks: [
            'Die Daten werden von sorgfältig ausgewählten Auftragsverarbeitern verarbeitet (Hosting, Datenbank, E-Mail, SMS, Zahlungen, Telefonie, KI-Modelle), mit denen Auftragsverarbeitungsverträge bestehen. Die Liste ist auf der Seite „Unterauftragsverarbeiter“ veröffentlicht.',
            'Wir können Daten an Behörden weitergeben, wenn das Gesetz es verlangt.',
          ],
        },
        {
          heading: '6. Übermittlung außerhalb der EU',
          blocks: [
            'Datenbank, App-Hosting, E-Mail und Automatisierungsserver befinden sich in der EU. Einige Anbieter (KI-Sprach- und Stimmmodelle, Telefonie, Teil des Zahlungssystems) verarbeiten Daten auch in den USA. Die Übermittlung ist durch Standardvertragsklauseln der Europäischen Kommission und, sofern der Anbieter teilnimmt, durch das EU-US Data Privacy Framework abgesichert.',
          ],
        },
        {
          heading: '7. Cookies',
          blocks: [
            'Die App verwendet nur technisch notwendige Cookies und lokalen Speicher: für die Anmeldung (Sitzung), die gewählte Sprache und das gewählte Unternehmen. Analyse-, Werbe- oder Tracking-Cookies verwenden wir nicht; eine Cookie-Einwilligung ist daher nicht erforderlich.',
          ],
        },
        {
          heading: '8. Kundendaten von Salons',
          blocks: [
            'Wenn Sie Kunde eines Unternehmens sind, das Jedro+ nutzt (z. B. eines Salons), ist dieses Unternehmen für Ihre Daten verantwortlich. Der Anbieter verarbeitet sie nur nach dessen Weisungen, für Buchungen, Erinnerungen, Benachrichtigungen und weitere genutzte Funktionen. Zur Ausübung Ihrer Rechte wenden Sie sich direkt an das Unternehmen; der Anbieter unterstützt es dabei.',
            '- Verarbeitet werden können: Vor- und Nachname, E-Mail, Telefonnummer, Geschlecht, Sprache, Notizen, Terminhistorie, Zahlungen, Einwilligung in Benachrichtigungen.',
            '- Neuigkeiten und Angebote: Jede solche Nachricht enthält einen Abmeldelink. Nach der Abmeldung erhalten Sie keine mehr; Terminerinnerungen werden weiterhin versendet.',
            `- Anrufe bei Receptionist+: Der Anruf wird aufgezeichnet und transkribiert, damit die KI-Assistentin einen Termin buchen oder eine Nachricht weitergeben kann. Darauf werden Sie zu Beginn des Anrufs hingewiesen. Aufzeichnungen und Transkripte werden ${F.callRetentionDays} Tage gespeichert.`,
            `- Das Protokoll versendeter SMS (Nummer, Zeit, Zustellstatus) wird ${F.smsLogRetentionMonths} Monate gespeichert.`,
          ],
        },
        {
          heading: '9. Automatisierte Entscheidungen',
          blocks: [
            'KI-Funktionen erstellen Antworten und Vorschläge, treffen aber keine Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung für Personen.',
          ],
        },
        {
          heading: '10. Sicherheit',
          blocks: [
            'Die Daten werden bei der Übertragung verschlüsselt (HTTPS/TLS) und bei zertifizierten Anbietern gespeichert. Der Zugriff ist durch Rollen und Regeln auf Datenbankebene beschränkt; die Daten jedes Unternehmens sind getrennt. Zugriff hat nur eine bevollmächtigte Person des Anbieters, wenn dies für Betrieb oder Support nötig ist.',
          ],
        },
        {
          heading: '11. Ihre Rechte',
          blocks: [
            `Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Senden Sie Anfragen an ${F.email}; wir antworten innerhalb eines Monats.`,
            'Sie können sich beim slowenischen Informationsbeauftragten (Informacijski pooblaščenec), Dunajska cesta 22, 1000 Ljubljana, www.ip-rs.si, oder bei der Aufsichtsbehörde Ihres Landes beschweren.',
          ],
        },
        {
          heading: '12. Änderungen',
          blocks: [
            'Wir können diese Erklärung aktualisieren. Über wesentliche Änderungen informieren wir per E-Mail; das Gültigkeitsdatum steht oben.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    dpa: {
      title: 'Auftragsverarbeitungsvertrag',
      summary:
        'Vertrag nach Art. 28 DSGVO zwischen dem Unternehmen, das Jedro+ nutzt (Verantwortlicher), und dem Anbieter (Auftragsverarbeiter). Er ist Bestandteil der Allgemeinen Nutzungsbedingungen und gilt mit deren Annahme.',
      sections: [
        {
          heading: '1. Parteien',
          blocks: [
            '- Verantwortlicher: das Unternehmen oder der Einzelunternehmer, der die Nutzungsbedingungen von Jedro+ angenommen hat (der „Nutzer“).',
            `- Auftragsverarbeiter: ${provider}, bevollmächtigte Person ${F.representative}, ${F.email} (der „Anbieter“).`,
          ],
        },
        {
          heading: '2. Gegenstand und Dauer',
          blocks: [
            'Der Anbieter verarbeitet personenbezogene Daten im Auftrag des Nutzers ausschließlich zur Bereitstellung der App Jedro+ im Umfang der genutzten Funktionen. Der Vertrag gilt, solange der Nutzungsvertrag besteht, und bis zur Löschung der Daten nach dessen Ende.',
          ],
        },
        {
          heading: '3. Art und Zweck der Verarbeitung',
          blocks: [
            'Speicherung, Ordnung, Anzeige, Versand von Nachrichten (E-Mail, SMS), Annahme und Transkription von Telefonanrufen, Erstellung von Antworten mit KI-Modellen, Abwicklung von Online-Zahlungen, Export und Löschung — zur Verwaltung von Terminen und Kunden, für Erinnerungen, Benachrichtigungen, Marketingnachrichten, Online-Buchung, Chatbot+ und Receptionist+.',
          ],
        },
        {
          heading: '4. Datenarten und betroffene Personen',
          blocks: [
            '- Kunden des Nutzers: Vor- und Nachname, E-Mail, Telefon, Geschlecht, Sprache, Notizen, Kundentyp, Terminhistorie, Leistungen, Preise und Rabatte, Zahlungsstatus, Einwilligung und Abmeldung.',
            '- Anrufer (Receptionist+): Telefonnummer, Aufzeichnung und Transkript des Gesprächs, Ergebnis des Anrufs.',
            '- Chat-Besucher (Chatbot+): Gesprächsinhalt und eingegebene Daten.',
            '- Mitarbeitende des Nutzers: Name, Kontakt, Dienstplan, Abwesenheiten, zugewiesene Termine.',
            'Besondere Kategorien personenbezogener Daten werden nur verarbeitet, wenn der Nutzer sie erfasst (z. B. in Notizen); der Nutzer sorgt für eine Rechtsgrundlage und beschränkt sie auf das Notwendige.',
          ],
        },
        {
          heading: '5. Pflichten des Anbieters',
          blocks: [
            '- Verarbeitet Daten nur nach dokumentierten Weisungen des Nutzers, die dieser durch Nutzung und Einstellungen der App erteilt, und informiert ihn, wenn er eine Weisung für rechtswidrig hält.',
            '- Verpflichtet Personen mit Zugriff auf die Daten zur Vertraulichkeit.',
            '- Setzt die technischen und organisatorischen Maßnahmen aus Abschnitt 7 um.',
            '- Unterstützt den Nutzer bei Anfragen Betroffener (Auskunft, Berichtigung, Löschung, Export) und bei den Pflichten nach Art. 32 bis 36 DSGVO.',
            '- Meldet dem Nutzer eine Verletzung des Schutzes personenbezogener Daten unverzüglich, spätestens 48 Stunden nach Kenntnisnahme, mit allen verfügbaren Informationen.',
            '- Stellt auf Anfrage die zum Nachweis der Einhaltung erforderlichen Informationen bereit und ermöglicht angemessene Überprüfungen (in der Regel durch Unterlagen und schriftliche Auskünfte).',
          ],
        },
        {
          heading: '6. Unterauftragsverarbeiter',
          blocks: [
            'Der Nutzer erteilt eine allgemeine Genehmigung für die auf der Seite „Unterauftragsverarbeiter“ genannten Unterauftragsverarbeiter. Der Anbieter verpflichtet jeden von ihnen zu denselben Datenschutzpflichten und haftet für sie wie für sich selbst.',
            'Über neue oder ersetzte Unterauftragsverarbeiter informiert der Anbieter mindestens 30 Tage im Voraus (per E-Mail oder in der App). Der Nutzer kann aus berechtigten Gründen widersprechen; findet sich keine Lösung, kann er ohne Kosten kündigen.',
            'Übermittlungen in Drittländer erfolgen nur mit geeigneten Garantien (Standardvertragsklauseln, EU-US Data Privacy Framework).',
          ],
        },
        {
          heading: '7. Technische und organisatorische Maßnahmen',
          blocks: [
            '- Verschlüsselung bei der Übertragung (TLS) und Verschlüsselung gespeicherter Daten beim Datenbankanbieter.',
            '- Datenbank, Hosting, E-Mail und Automatisierungsserver in der EU.',
            '- Trennung der Daten je Unternehmen; Zugriffsregeln auf Datenbankebene (RLS); Schreibzugriffe nur über geprüfte Serverrouten.',
            '- Rollenbasierter Zugriff (Inhaber, Administrator, Mitarbeitende) und Prinzip der minimalen Rechte; geheime Schlüssel nur auf dem Server.',
            '- Begrenzung der Anfragen und Schutz vor Missbrauch; signierte Links (z. B. zur Abmeldung).',
            '- Regelmäßige Sicherungen beim Datenbankanbieter; Protokollierung von Änderungen an Terminen und Kunden.',
            '- Automatische Löschung von Anrufaufzeichnungen nach 90 Tagen und von Daten nach Vertragsende.',
          ],
        },
        {
          heading: '8. Pflichten des Nutzers',
          blocks: [
            '- Hat eine Rechtsgrundlage für die Verarbeitung der Daten seiner Kunden, Mitarbeitenden und Anrufer und informiert diese (z. B. in seiner eigenen Datenschutzerklärung).',
            '- Versendet Marketingnachrichten nur an Kunden, für die eine Grundlage besteht, und beachtet Abmeldungen.',
            '- Lässt den Aufzeichnungshinweis bei Receptionist+ aktiviert oder stellt selbst die Rechtmäßigkeit der Aufzeichnung sicher.',
            '- Gewährt Zugriff auf die App nur Personen, die ihn benötigen, und entzieht ihn rechtzeitig.',
          ],
        },
        {
          heading: '9. Ende der Verarbeitung',
          blocks: [
            `Nach Vertragsende kann der Nutzer die Daten exportieren. Der Anbieter löscht sie ${F.deletionAfterEndDays} Tage nach dem Ende, einschließlich Kopien bei Unterauftragsverarbeitern im Rahmen ihrer Sicherungsfristen, sofern keine gesetzliche Aufbewahrungspflicht besteht.`,
          ],
        },
        {
          heading: '10. Schlussbestimmungen',
          blocks: [
            'Für die Haftung gelten die Nutzungsbedingungen, soweit die DSGVO nichts anderes bestimmt. Es gilt das Recht der Republik Slowenien. Bei Abweichungen zwischen Sprachfassungen gilt die slowenische.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    subprocessors: {
      title: 'Unterauftragsverarbeiter',
      summary:
        'Externe Anbieter, die für Jedro+ personenbezogene Daten verarbeiten. Änderungen kündigen wir 30 Tage im Voraus an.',
      sections: [
        {
          heading: 'Infrastruktur (EU)',
          blocks: [
            '- Supabase — Datenbank, Anmeldung und Dateispeicher — EU (Stockholm, Schweden)',
            '- Vercel — Hosting der App — EU (Stockholm, Schweden)',
            '- Hetzner Online — Automatisierungsserver (n8n) — EU',
            '- Upstash — Begrenzung von Anfragen (IP-Adressen, kurzfristig) — EU (Frankfurt, Deutschland)',
          ],
        },
        {
          heading: 'Nachrichten',
          blocks: [
            '- Amazon Web Services (Amazon SES) — E-Mail-Versand — EU (Stockholm, Schweden)',
            '- BulkGate — SMS-Versand — EU (Tschechien)',
          ],
        },
        {
          heading: 'Zahlungen',
          blocks: [
            '- Stripe — Abonnements, Credit-Käufe und Online-Zahlungen von Kunden — EU (Irland), teilweise USA',
          ],
        },
        {
          heading: 'Receptionist+ und KI-Funktionen',
          blocks: [
            '- Telnyx — Telefonnummern und Anrufübertragung — USA und globales Netz',
            '- Soniox — Spracherkennung (Transkription von Anrufen) — USA',
            '- ElevenLabs — Sprachsynthese (Stimme der Assistentin) — USA',
            '- Anthropic (Claude) — Sprachmodell für Gespräche und Nachrichtenvorschläge — USA',
            '- OpenAI — Sprachmodell für Gespräche und Nachrichtenvorschläge — USA',
            'Bei Anbietern in den USA ist die Übermittlung durch Standardvertragsklauseln und, sofern der Anbieter teilnimmt, durch das EU-US Data Privacy Framework abgesichert. KI-Modellanbieter verwenden die Daten nicht zum Training.',
          ],
        },
      ],
    },
  },
};
