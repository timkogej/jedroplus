# Jedro+ — logotip in blagovna znamka

Vse, kar je v tem repozitoriju povezano z logotipom, izhaja iz ene same datoteke:
[`lib/brand/geometry.ts`](lib/brand/geometry.ts). Tam so barve, geometrija plusa in
obrisane črke besedne znamke. Ko se kaj od tega spremeni, se z enim ukazom
na novo zgenerira celoten komplet:

```bash
npm run brand
```

Črkovje v logotipu je pretvorjeno v krivulje (outlines), zato je logotip
neodvisen od tega, ali je pisava na napravi nameščena ali naložena.

---

## 1. Barve

| Vloga | Hex | Uporaba |
| --- | --- | --- |
| Jedro Ink | `#1E2021` | črke »Jedro«, črna enobarvna različica |
| Jedro Violet | `#7C78FA` | začetek preliva (zgoraj levo) |
| Jedro Cyan | `#35E3DB` | konec preliva (spodaj desno) |
| Jedro Blue | `#59AEEA` | optična sredina preliva — za ploskovne poudarke brez preliva |

Preliv teče vedno po diagonali **zgoraj levo → spodaj desno** (135°):

```css
background: linear-gradient(135deg, #7C78FA 0%, #35E3DB 100%);
```

V CSS so na voljo kot spremenljivke v `app/globals.css`:
`--brand-ink`, `--brand-violet`, `--brand-cyan`, `--brand-blue`, `--gradient-brand`.

---

## 2. Različice logotipa

Izvorne vektorske datoteke so v [`public/brand/`](public/brand) in so
dostopne tudi na `/brand/<ime>.svg`.

### Vodoravna postavitev (primarna)

| Datoteka | Kdaj |
| --- | --- |
| `jedro-logo.svg` | privzeto — svetla podlaga |
| `jedro-logo-white.svg` | temna podlaga ali fotografija; plus ostane v prelivu |
| `jedro-logo-mono-black.svg` | enobarvni tisk, gravura, faks, žig |
| `jedro-logo-mono-white.svg` | enobarvno na temnem ali barvnem |
| `jedro-logo-plate-white.svg` | logotip na beli ploščici z že vgrajenim prostim robom |
| `jedro-logo-plate-ink.svg` | isto, na temni ploščici |

Razmerje je fiksno **972 : 251** (≈ 3,873 : 1). Logotip se nikoli ne razteguje
po samo eni osi.

### Znak (plus)

| Datoteka | Kdaj |
| --- | --- |
| `jedro-mark.svg` | ozki prostori, avatarji, nalaganje, favicon brez ploščice |
| `jedro-mark-white.svg` | na temni ali barvni podlagi |
| `jedro-mark-black.svg` | enobarvno |

### Ikona aplikacije

| Datoteka | Kdaj |
| --- | --- |
| `jedro-icon.svg` | zaobljena ploščica — favicon, Android, PWA |
| `jedro-icon-square.svg` | polna kvadratna ploščica — iOS sam doda masko |
| `jedro-icon-maskable.svg` | Android `maskable` — plus je manjši, da preživi obrez |

---

## 3. Rasterske datoteke (PNG)

V [`public/brand/png/`](public/brand/png):

- `jedro-logo-{480,960,1920,3840}.png` — črke v `#1E2021`, plus v prelivu
- `jedro-logo-white-{…}.png` — **bele črke**, plus ostane v prelivu
- `jedro-logo-mono-black-{…}.png` in `jedro-logo-mono-white-{…}.png` — vse v eni barvi
- `jedro-mark-{32,64,128,256,512,1024}.png` in `jedro-mark-white-{…}.png`
- `jedro-icon-{64,128,192,256,512,1024}.png`

**Vsi PNG-ji imajo prozorno ozadje** (RGBA, 4 kanali). Edina izjema so datoteke
z besedo `safe` v imenu in `jedro-logo-plate-*`, kjer je bela podlaga del slike
namenoma — glej poglavje o e-pošti.

PNG uporabi samo tam, kjer SVG ni mogoč (e-pošta, Office, nekateri oglasni
sistemi, profilne slike). Povsod drugje ima SVG prednost.

Za tisk uporabi `jedro-logo-3840.png` ali, še bolje, kar SVG.

---

## 4. Podpis v e-pošti

V [`public/brand/email/`](public/brand/email). Poštni odjemalci **ne znajo
prikazati SVG-ja** in Outlook ignorira CSS velikosti, zato so te datoteke
narejene posebej: vsaka je zrisana v dvakratni ločljivosti, v HTML-ju pa se
velikost zaklene z atributoma `width` in `height`. Tako je podpis oster na
retina zaslonih in hkrati pravilno velik v Outlooku.

| Datoteka | Kdaj |
| --- | --- |
| `jedro-logo-email-{160,200,240}.png` | privzeto — svetla podlaga podpisa |
| `jedro-logo-email-white-{…}.png` | če ima tvoj podpis temno podlago |
| `jedro-logo-email-safe-{…}.png` | **najbolj varno** — bela podlaga je del slike |
| `jedro-mark-email-{32,40,48}.png` | samo znak, za ozke podpise |

Številka v imenu je širina v slikovnih pikah, **kot naj bo prikazana**. Datoteka
sama je dvakrat večja — tega ne popravljaj.

### Katero izbrati

Gmail in Outlook v temnem načinu za sliko pogosto narišeta temno podlago. Črke
`Jedro` so skoraj črne, zato v takem primeru izginejo. Če ti je do tega, da
podpis povsod zagotovo deluje, uporabi različico **`safe`** — ta nosi svojo belo
ploščico s sabo in je videti enako v vseh odjemalcih.

### Kako vstaviti

V [`public/brand/email/signature.html`](public/brand/email/signature.html) je
pripravljen izsek, ki ga samo prilepiš. Pred uporabo:

1. `BASE_URL` zamenjaj z javnim naslovom aplikacije (npr. `https://jedroplus.si`).
   Slika **mora** biti na absolutnem naslovu — poštni odjemalec ne vidi datoteke
   na tvojem računalniku.
2. Zamenjaj polja z VELIKIMI ČRKAMI.
3. Gmail: Nastavitve → Ogled vseh nastavitev → Podpis.
   Outlook: Datoteka → Možnosti → Pošta → Podpisi.
4. Slike **ne vleci za vogal**, da bi jo povečal — s tem pokvariš ostrino.

---

## 5. Kje se logotip uporablja v aplikaciji

```tsx
import { JedroLogo, JedroMark } from '@/components/brand/JedroLogo';

<JedroLogo height={32} />                    // barvna postavitev
<JedroLogo height={32} tone="onDark" />      // na temnem
<JedroLogo height={32} tone="mono" color="#000" />
<JedroMark size={24} />                      // samo plus
```

Komponenti sta strežniški (Server Component) — za prikaz logotipa ni treba
`'use client'`.

Ikone in favicon se generirajo v `app/icon.png`, `app/apple-icon.png` in
`app/favicon.ico`; Next.js jih pobere sam prek konvencije datotek, zato jih v
`metadata` ni treba naštevati.

---

## 6. Pravila uporabe

**Prosti prostor.** Okoli logotipa mora ostati prazen rob, širok vsaj
**polovico višine plusa**. Pri postavitvi z višino 32 px je to 8 px na vsaki
strani. Noben drug element ne sme vstopiti v ta rob.

**Najmanjše velikosti.**

| | Zaslon | Tisk |
| --- | --- | --- |
| Vodoravna postavitev | 96 px širine | 25 mm širine |
| Znak (plus) | 16 px | 5 mm |

**Podlaga.** Logotip potrebuje mirno podlago. Na fotografijah uporabi belo
različico in poskrbi za dovolj kontrasta — po potrebi zatemni podlago.

**Česa ne delamo.**

- ne spreminjamo razmerja, ne poševimo, ne ukrivljamo
- ne menjamo barv preliva in ne obračamo njegove smeri
- ne dodajamo sence, obrobe, odseva ali 3D učinkov
- plusa ne zamenjamo z drugim simbolom in ga ne premikamo glede na besedo
- besede »Jedro« ne prepisujemo z nameščeno pisavo — vedno uporabi datoteko
- logotipa ne postavljamo na podlago, ki je premalo kontrastna

**Prozornost.** Plus je ena sama zaključena pot, zato ga je varno risati z
zmanjšano prozornostjo — spoji se ne pokažejo.

---

## 7. Kako je komplet zgrajen

`scripts/build-brand.mjs` prebere `lib/brand/geometry.ts`, sestavi vse SVG-je
in jih z `sharp` pretvori v PNG-je, favicon (`app/favicon.ico`, PNG v 16/32/48),
ikone za PWA, komplet za e-poštni podpis in `public/og-image.png` (1200 × 630)
za predoglede v družabnih omrežjih.

Nobene od teh datotek ne urejaj ročno — popravi geometrijo in poženi
`npm run brand`.
