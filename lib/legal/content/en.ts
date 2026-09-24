import { LEGAL_FACTS as F } from '../facts';
import type { LegalContent } from '../types';

const provider = `${F.provider}, ${F.address}, Slovenia, registration number ${F.registrationNumber}`;

export const en: LegalContent = {
  ui: {
    draftBanner: 'Draft. This text has not been legally reviewed yet and may change.',
    lastUpdated: 'Effective from',
    bindingNote: 'This is a translation. If it differs from the Slovenian version, the Slovenian version applies.',
    otherDocuments: 'Other documents',
    languageLabel: 'Language',
  },
  docs: {
    // ─────────────────────────────────────────────────────────────────────────
    terms: {
      title: 'Terms of Service',
      summary:
        'The terms under which businesses use the Jedro+ app for bookings, clients, reminders, Receptionist+ and other features.',
      sections: [
        {
          heading: '1. Provider',
          blocks: [
            `The ${F.product} app is provided by ${provider} (the "Provider"). ${F.representative} is authorised and responsible for the service. Contact: ${F.email}.`,
            'The Provider is not registered for VAT. Prices are final; no VAT is charged under Article 94(1) of the Slovenian VAT Act (ZDDV-1).',
          ],
        },
        {
          heading: '2. Who the service is for',
          blocks: [
            `${F.product} is for business use only: companies, sole traders and other persons who use the app to carry out their business (the "User"). By signing up, the User confirms that they are not using the app as a consumer.`,
            "The Provider does not check whether the User's business is registered. The User alone is responsible for running their business in line with the laws that apply to them (registration, tax, data protection, consumer protection, advertising).",
            "The person who created the account (the owner) is responsible for it. The owner may invite colleagues and assign roles, and is responsible for their actions in the app as for their own.",
          ],
        },
        {
          heading: '3. What the service includes',
          blocks: [
            'Features depend on the chosen plan and add-ons, including:',
            '- calendar, appointments, services, staff and resources;',
            '- client records and appointment history;',
            '- online booking and client self-registration through a public link;',
            '- reminders and notices to clients by email and SMS;',
            '- sending news and offers to clients (Communication);',
            '- Chatbot+ (AI chat for clients) and Receptionist+ (AI phone assistant);',
            '- online payments from clients through Stripe;',
            '- analytics, promotions and exports.',
            'The Provider may improve, change or discontinue features. It will not materially reduce paid features during an already paid period without prior notice.',
          ],
        },
        {
          heading: '4. Sign-up and access',
          blocks: [
            'The User must give accurate information and keep it up to date, keep access credentials (passwords, sign-in links) safe, and tell the Provider without delay about any misuse.',
            "Team join codes and links give access to the business's data, so the User shares them only with people they allow to have access.",
          ],
        },
        {
          heading: '5. Plans, prices and payment',
          blocks: [
            'Current plans and prices are shown in the app (Settings → Plans). The free plan includes a one-time trial allowance of messages that does not renew.',
            'Subscriptions are paid in advance, monthly or yearly, through the payment provider Stripe, and renew automatically until cancelled. Monthly add-ons (SMS, email, extra users) are billed with the subscription.',
            'Receptionist+ credits are bought in packs with a one-time payment. On first activation the User receives trial credits. Credits do not expire and are not refundable.',
            'Once the monthly SMS or email allowance is used up, further messages are not sent until renewal or the purchase of an add-on. SMS are sent only to numbers from the countries listed in the app (currently Slovenia, Croatia, Austria, Germany and Italy); other numbers receive email.',
            'The Provider may change prices. It will announce a change by email at least 30 days in advance; it applies from the next billing period. A User who does not agree may cancel.',
          ],
        },
        {
          heading: '6. Cancellation',
          blocks: [
            'The User may cancel at any time in the app or through the Stripe portal. Cancellation takes effect at the end of the paid period; the service works until then. Payments for the current or unused period are not refunded unless the law requires otherwise.',
            'The Provider may restrict access or terminate the agreement if the User fails to pay amounts due, seriously or repeatedly breaches these terms, or if continuing would break the law. Except for serious breaches, it will first warn the User and give a reasonable time to put things right.',
            `After the agreement ends, the Provider keeps the User's data for another ${F.deletionAfterEndDays} days so the User can export it or renew, and then deletes it, except data the law requires it to keep (e.g. invoices).`,
          ],
        },
        {
          heading: "7. User's obligations",
          blocks: [
            'The User must not use the app for unlawful purposes, to send unsolicited messages, to collect third-party data without a legal basis, to disrupt the service or to attempt unauthorised access.',
            "The User is the controller of the personal data of their clients, staff and callers entered or collected in the app. They must have a legal basis for it and inform those people. The Provider processes this data as a processor under the Data Processing Agreement, which forms part of these terms.",
            'The User does not enter special categories of personal data (e.g. health data) without an appropriate legal basis, and only to the extent strictly necessary.',
            'To send news and offers (Communication), the User must have a proper basis (consent or the existing-customer exception). The app adds an unsubscribe link to every such message and stops sending to clients who unsubscribe.',
            'Receptionist+ records and transcribes calls. The recording notice is on by default; if the User turns it off, the User alone is responsible for the lawfulness of recording.',
          ],
        },
        {
          heading: '8. Artificial intelligence',
          blocks: [
            'Some features (message suggestions, Chatbot+, Receptionist+) use language and voice models from third-party providers. Answers are generated automatically and may be inaccurate or incomplete. The User must check important information (e.g. appointments, prices, instructions) and set up the features so that they do not mislead clients.',
            'The Provider does not use client data to train models and does not allow model providers to do so.',
          ],
        },
        {
          heading: '9. Content and rights',
          blocks: [
            'Data and content the User enters remain theirs. The User grants the Provider the right to process them as needed to provide the service.',
            `The app, its code, design and the ${F.product} brand belong to the Provider. The User receives a non-exclusive, non-transferable right to use it for the duration of the agreement.`,
          ],
        },
        {
          heading: '10. Availability',
          blocks: [
            'The Provider aims to keep the service running without interruption but does not guarantee it. The service may be temporarily unavailable because of maintenance, updates or outages at third-party providers (hosting, SMS, email, payments, AI models). Longer planned maintenance is announced in advance.',
          ],
        },
        {
          heading: '11. Liability',
          blocks: [
            "The Provider is liable for damage caused intentionally or through gross negligence. For other damage, the Provider's liability is limited to the amount the User paid the Provider in the 12 months before the damage occurred.",
            "The Provider is not liable for indirect damage (e.g. lost profit, missed appointments), damage caused by the User's incorrect data or settings, messages not delivered for reasons on the side of carriers or recipients, inaccurate AI answers the User did not check, or outages at third-party providers beyond its control.",
            "The User indemnifies the Provider against third-party claims arising from the User's unlawful use of the app or breach of these terms.",
          ],
        },
        {
          heading: '12. Changes to these terms',
          blocks: [
            'The Provider may change these terms. It will inform the User of material changes by email at least 30 days before they take effect. Continuing to use the service after that means the User accepts them; a User who does not agree may cancel before they take effect.',
          ],
        },
        {
          heading: '13. Law and disputes',
          blocks: [
            'These terms are governed by the law of the Republic of Slovenia. The parties will try to settle disputes amicably; otherwise the competent court in Ljubljana has jurisdiction.',
            'These terms are published in several languages. If they differ, the Slovenian version applies.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    privacy: {
      title: 'Privacy Policy',
      summary:
        "How Jedro+ processes the personal data of app users, and how it processes salons' client data on their behalf.",
      sections: [
        {
          heading: '1. Controller',
          blocks: [
            `The controller of the personal data of ${F.product} users is ${provider}. ${F.representative} is responsible for data protection. Contact for all questions and requests: ${F.email}.`,
            'For the data of clients, staff and callers that businesses (e.g. salons) keep in the app, that business is the controller; the Provider processes it only on its behalf (see section 8).',
          ],
        },
        {
          heading: '2. Data we process',
          blocks: [
            '- Account data: name, email address, password (stored as a hash), team role, app language.',
            '- Business data: name, industry, address, country, tax number, contact phone and email, logo, opening hours, settings.',
            '- Subscription and payment data: plan, add-ons, message usage, invoices. Card data is processed by Stripe; the Provider does not see it.',
            '- Technical data: IP address and time of requests (for security and abuse prevention), server error logs.',
            '- Communication: messages the User sends the Provider (e.g. enquiries, support).',
          ],
        },
        {
          heading: '3. Purposes and legal bases',
          blocks: [
            '- Performance of the contract (Art. 6(1)(b) GDPR): creating the account, providing features, billing, support, service notices (e.g. allowance used up, failed payment).',
            '- Legal obligations (Art. 6(1)(c) GDPR): keeping invoices and accounting records.',
            '- Legitimate interests (Art. 6(1)(f) GDPR): security and abuse prevention, fixing errors, improving the service based on aggregated, non-personal statistics.',
            'We do not sell data and do not use it for third-party advertising.',
          ],
        },
        {
          heading: '4. How long we keep data',
          blocks: [
            `- Account and business data: for the duration of the contract and ${F.deletionAfterEndDays} days after it ends, then deleted.`,
            '- Invoices and accounting records: as long as the law requires (10 years for invoices).',
            '- Technical data for abuse prevention: short term; error logs: at most 30 days.',
          ],
        },
        {
          heading: '5. Who we share data with',
          blocks: [
            'Data is processed by carefully selected processors (hosting, database, email, SMS, payments, telephony, AI models) under data processing agreements. The list is published on the "Sub-processors" page.',
            'We may disclose data to public authorities where the law requires it.',
          ],
        },
        {
          heading: '6. Transfers outside the EU',
          blocks: [
            'The database, app hosting, email and automation server are in the EU. Some providers (AI language and voice models, telephony, part of the payment system) also process data in the USA. Such transfers are protected by the European Commission\'s Standard Contractual Clauses and, where the provider participates, the EU-US Data Privacy Framework.',
          ],
        },
        {
          heading: '7. Cookies',
          blocks: [
            'The app uses only strictly necessary cookies and local storage: for sign-in (session), the chosen language and the chosen business. We use no analytics, advertising or tracking cookies, so no cookie consent is needed.',
          ],
        },
        {
          heading: "8. Salons' client data",
          blocks: [
            'If you are a client of a business that uses Jedro+ (e.g. a salon), that business controls your data. The Provider processes it only on the business\'s instructions, for bookings, reminders, notices and the other features the business uses. To exercise your rights, contact the business directly; the Provider will help it.',
            '- Data that may be processed: first and last name, email, phone number, gender, language, notes, appointment history, payments, marketing consent.',
            '- News and offers: every such message contains an unsubscribe link. After unsubscribing you no longer receive them; appointment reminders are still sent.',
            `- Calls to Receptionist+: the call is recorded and transcribed so the AI assistant can book an appointment or pass on a message. You are told this at the start of the call. Recordings and transcripts are kept for ${F.callRetentionDays} days.`,
            `- The log of sent SMS (number, time, delivery status) is kept for ${F.smsLogRetentionMonths} months.`,
          ],
        },
        {
          heading: '9. Automated decision-making',
          blocks: [
            'AI features prepare answers and suggestions; they do not make decisions with legal or similarly significant effects on individuals.',
          ],
        },
        {
          heading: '10. Security',
          blocks: [
            "Data is encrypted in transit (HTTPS/TLS) and stored with certified providers. Access is limited by roles and database-level rules; each business's data is kept separate. Only an authorised person at the Provider has access, when needed for operation or support.",
          ],
        },
        {
          heading: '11. Your rights',
          blocks: [
            `You have the right of access, rectification, erasure, restriction, portability and objection. Send requests to ${F.email}; we reply within one month.`,
            'You may lodge a complaint with the Slovenian Information Commissioner (Informacijski pooblaščenec), Dunajska cesta 22, 1000 Ljubljana, www.ip-rs.si, or with the supervisory authority in your country.',
          ],
        },
        {
          heading: '12. Changes',
          blocks: [
            'We may update this policy. We inform users of material changes by email; the effective date is shown at the top.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    dpa: {
      title: 'Data Processing Agreement',
      summary:
        'Agreement under Article 28 GDPR between the business using Jedro+ (controller) and the Provider (processor). It forms part of the Terms of Service and applies once they are accepted.',
      sections: [
        {
          heading: '1. Parties',
          blocks: [
            '- Controller: the company or sole trader that accepted the Jedro+ Terms of Service (the "User").',
            `- Processor: ${provider}, authorised person ${F.representative}, ${F.email} (the "Provider").`,
          ],
        },
        {
          heading: '2. Subject matter and duration',
          blocks: [
            'The Provider processes personal data on behalf of the User solely to provide the Jedro+ app, to the extent of the features the User uses. This agreement applies for as long as the service agreement does, and until the data is deleted after it ends.',
          ],
        },
        {
          heading: '3. Nature and purpose of processing',
          blocks: [
            'Storage, organisation, display, sending messages (email, SMS), answering and transcribing phone calls, preparing answers with AI models, processing online payments, export and deletion — for managing appointments and clients, reminders, notices, marketing messages, online booking, Chatbot+ and Receptionist+.',
          ],
        },
        {
          heading: '4. Types of data and data subjects',
          blocks: [
            "- The User's clients: first and last name, email, phone, gender, language, notes, client type, appointment history, services, prices and discounts, payment status, marketing consent and unsubscribes.",
            '- Callers (Receptionist+): phone number, call recording and transcript, call outcome.',
            '- Chat visitors (Chatbot+): conversation content and data they enter.',
            "- The User's staff: name, contact, schedule, absences, assigned appointments.",
            'Special categories of data are processed only if the User enters them (e.g. in notes); the User ensures a legal basis and limits them to what is necessary.',
          ],
        },
        {
          heading: "5. Provider's obligations",
          blocks: [
            "- Processes data only on the User's documented instructions, given through the use and settings of the app, and informs the User if it considers an instruction unlawful.",
            '- Ensures that persons with access to the data are bound by confidentiality.',
            '- Implements the technical and organisational measures in section 7.',
            '- Assists the User with data subject requests (access, rectification, erasure, export) and with obligations under Articles 32 to 36 GDPR.',
            '- Notifies the User of a personal data breach without undue delay and no later than 48 hours after becoming aware of it, with all information available.',
            '- Provides, on request, the information needed to demonstrate compliance and allows reasonable audits (normally through documentation and written answers).',
          ],
        },
        {
          heading: '6. Sub-processors',
          blocks: [
            'The User gives general authorisation for the sub-processors listed on the "Sub-processors" page. The Provider binds each of them to the same data protection obligations and is liable for them as for itself.',
            'The Provider informs the User of any new or replaced sub-processor at least 30 days in advance (by email or in the app). The User may object on reasonable grounds; if no solution is found, the User may terminate without cost.',
            'Transfers to third countries take place only with appropriate safeguards (Standard Contractual Clauses, EU-US Data Privacy Framework).',
          ],
        },
        {
          heading: '7. Technical and organisational measures',
          blocks: [
            '- Encryption in transit (TLS) and encryption at rest at the database provider.',
            '- Database, hosting, email and automation server in the EU.',
            '- Separation of data per business; database-level access rules (RLS); data written only through verified server routes.',
            '- Role-based access (owner, administrator, staff) and least privilege; secret keys on the server only.',
            '- Rate limiting and abuse protection; signed links (e.g. for unsubscribing).',
            '- Regular backups at the database provider; logging of changes to appointments and clients.',
            '- Automatic deletion of call recordings after 90 days and of data after the agreement ends.',
          ],
        },
        {
          heading: "8. User's obligations",
          blocks: [
            '- Has a legal basis for processing the data of its clients, staff and callers and informs them (e.g. in its own privacy policy).',
            '- Sends marketing messages only to clients for whom it has a basis, and respects unsubscribes.',
            '- Keeps the Receptionist+ recording notice on, or itself ensures that recording is lawful.',
            '- Gives access to the app only to people who need it and removes access in time.',
          ],
        },
        {
          heading: '9. End of processing',
          blocks: [
            `After the agreement ends the User may export the data. The Provider deletes it ${F.deletionAfterEndDays} days after the end, including copies at sub-processors within their backup periods, unless the law requires it to be kept.`,
          ],
        },
        {
          heading: '10. Final provisions',
          blocks: [
            'Liability is governed by the Terms of Service except where the GDPR provides otherwise. The law of the Republic of Slovenia applies. If language versions differ, the Slovenian version applies.',
          ],
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    subprocessors: {
      title: 'Sub-processors',
      summary:
        'Third-party providers that process personal data for Jedro+. We announce changes 30 days in advance.',
      sections: [
        {
          heading: 'Infrastructure (EU)',
          blocks: [
            '- Supabase — database, sign-in and file storage — EU (Stockholm, Sweden)',
            '- Vercel — app hosting — EU (Stockholm, Sweden)',
            '- Hetzner Online — automation server (n8n) — EU',
            '- Upstash — request rate limiting (IP addresses, short term) — EU (Frankfurt, Germany)',
          ],
        },
        {
          heading: 'Messaging',
          blocks: [
            '- Amazon Web Services (Amazon SES) — sending email — EU (Stockholm, Sweden)',
            '- BulkGate — sending SMS — EU (Czech Republic)',
          ],
        },
        {
          heading: 'Payments',
          blocks: [
            '- Stripe — subscriptions, credit purchases and online payments from clients — EU (Ireland), partly USA',
          ],
        },
        {
          heading: 'Receptionist+ and AI features',
          blocks: [
            '- Telnyx — phone numbers and call transport — USA and global network',
            '- Soniox — speech recognition (call transcription) — USA',
            "- ElevenLabs — speech synthesis (the assistant's voice) — USA",
            '- Anthropic (Claude) — language model for conversations and message suggestions — USA',
            '- OpenAI — language model for conversations and message suggestions — USA',
            'For providers in the USA, transfers are protected by Standard Contractual Clauses and, where the provider participates, the EU-US Data Privacy Framework. AI model providers do not use the data to train models.',
          ],
        },
      ],
    },
  },
};
