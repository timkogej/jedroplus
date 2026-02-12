This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Smoke test (dashboard)

1. Odpri app -> `/company`.
2. Vpiši neveljaven ID -> error.
3. Vpiši veljaven ID (mora obstajati v `"Podatki podjetij"` / `"ID Podjetja"`) -> `/dashboard`.
4. Na `/dashboard` preveri:
   - Nastavitve podjetja se naložijo.
   - Tabela imena sledijo `"Tabela ..."` poljem, če so nastavljena.
   - KPI kartice pokažejo vrednosti (ali “-” z razlogom).
   - Današnji jutrišnji termini so filtrirani na podjetje.
5. Končaj termin / no-show / prekliči / izbriši in preveri spremembe.
6. Ustvari termin prek “New booking” in preveri, da se pojavi v seznamu.
7. Zamenjaj podjetje -> nazaj na `/company` -> ponovi z drugim ID.

## Smoke test (clients + bookings)

1. Izberi podjetje -> `/clients` pokaže samo stranke tega podjetja.
2. Dodaj stranko -> pojavi se v tabeli, edit + delete delujeta.
3. Odpri detail stranke -> vidiš JSON + zadnjih 20 terminov (če obstajajo).
4. `/bookings` pokaže samo termine podjetja.
5. Filtri (today/tomorrow/upcoming/past/all) delujejo.
6. Ustvari termin -> pojavi se v seznamu.
7. Complete/no-show/cancel/delete posodobijo status.
8. Complete posodobi “Zadnja interakc” stranke, če stolpec obstaja.

## Supabase write policy

- Frontend never writes to Supabase directly; all mutations go through the n8n workflow.
- Ensure Supabase RLS policies deny INSERT/UPDATE/DELETE for anon clients on all business tables.
- Only the n8n workflow (service role) should perform writes.
