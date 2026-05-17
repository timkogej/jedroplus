# Design Handoff — JedroPlus

> **Scope:** Sidebar component (desktop + mobile) and all Nastavitve subpages.
> **Focus:** Layout, spacing, typography, color, components, states, motion — no business logic.

---

## Table of Contents

1. [Sidebar — Desktop](#sidebar--desktop)
2. [Sidebar — Mobile](#sidebar--mobile)
3. [Nastavitve — Layout Shell](#nastavitve--layout-shell)
4. [Nastavitve — Settings Tab Bar](#nastavitve--settings-tab-bar)
5. [Nastavitve — Shared Components](#nastavitve--shared-components)
6. [Nastavitve — Podjetje](#nastavitve--podjetje)
7. [Nastavitve — Splošno](#nastavitve--splosno)
8. [Nastavitve — Člani](#nastavitve--clani)
9. [Nastavitve — Sporočila](#nastavitve--sporocila)
10. [Design Tokens](#design-tokens)

---

## Sidebar — Desktop

**File:** `components/layout/Sidebar.tsx`
**Context:** `components/layout/sidebar-context.tsx`

### Layout & Dimensions

| State     | Width      |
|-----------|------------|
| Expanded  | 280px (default), resizable 240–400px |
| Collapsed | 80px (fixed) |

- Position: `fixed left-0 top-0 bottom-0` — full viewport height.
- Z-index: `z-40`.
- Display: `hidden md:flex flex-col` — desktop only (breakpoint: 768px).
- Overflow: `overflow-hidden` on the sidebar; `overflow-y-auto` on the nav scroll region.
- CSS transition on width: `transition-all duration-300`.
- Width is applied inline via `style={{ width: effectiveWidth }}`.
- A spacer div (`hidden md:block flex-shrink-0 transition-all duration-300`) of the same width pushes page content.

### Colors & Borders

```
Background:     bg-white
Right border:   border-r border-gray-200
Internal dividers: border-b border-gray-100 / border-t border-gray-100
Bottom area bg: bg-gray-50/50
```

### Header Area

Height: `h-16`. Padding: `px-4`. Border: `border-b border-gray-100`.

**Expanded state:**
- Logo image `56×56px`, `flex-shrink-0`.
- App name "Jedro+":
  ```
  text-lg font-bold
  background: linear-gradient(90deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)
  -webkit-background-clip: text
  -webkit-text-fill-color: transparent
  ```
- Company name below: `text-xs text-gray-500 truncate`.
- Collapse button (right): `p-1.5 hover:bg-gray-100 rounded-lg transition-colors`.
  - Icon: `CaretLeft w-4 h-4 text-gray-400`.
  - Motion: `whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}`.

**Collapsed state:**
- Logo image `48×48px`, centered.
- Motion: `whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}`.

### User Card (expanded only)

Padding: `px-4 py-4`. Border: `border-b border-gray-100`.

```
Avatar container: w-11 h-11 rounded-full p-[2px]
                  bg-gradient-to-br from-violet-500 to-cyan-500
Avatar inner:     w-full h-full rounded-full bg-white
                  flex items-center justify-center
Initials:         text-sm font-semibold text-gray-700
Online dot:       absolute bottom-0 right-0
                  w-3 h-3 bg-emerald-500 rounded-full border-2 border-white
Name:             text-sm font-semibold text-gray-900 truncate
Email:            text-xs text-gray-500 truncate
```

### Navigation

Container: `flex-1 overflow-y-auto py-4 px-3`.

**Section grouping:**
```
Section wrapper:  mb-6
Section label:    px-3 pb-2
                  text-[11px] font-semibold text-gray-400 tracking-wider
                  (rendered uppercase via .toUpperCase())
Items wrapper:    space-y-1
```

**Nav item — base:**
```
flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
```

**Nav item — states:**
```
Default:  text-gray-600 hover:text-gray-900 hover:bg-gray-50 hover:scale-[1.01]
Active:   bg-gray-100
Locked:   opacity-50 (no hover scale)
```

**Nav item — icon:**
```
Size:    w-5 h-5 flex-shrink-0
Active:  weight="fill"  color: text-gray-900
Default: weight="regular"  color: text-gray-500
         group-hover → text-gray-700
```

**Nav item — label text:**
```
Active:  font-semibold text-sm text-gray-900
Default: font-medium text-sm
```

**Nav item — badges (right side):**

| Badge type    | Classes |
|---------------|---------|
| Alert (!)     | `w-5 h-5 bg-orange-500 rounded-full text-white text-[10px] font-bold` |
| "Novo" pill   | `px-2 py-0.5 text-[10px] font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full` |
| Lock icon     | `w-3.5 h-3.5 text-gray-400` |

**Collapsed state extras:**
- Icon centered: `justify-center` on the item.
- Alert dot: `absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border border-white`.
- Tooltip on hover:
  ```
  absolute left-full ml-3 px-3 py-1.5
  bg-gray-900 text-white text-xs font-medium rounded-lg
  opacity-0 invisible
  group-hover:opacity-100 group-hover:visible
  transition-all whitespace-nowrap z-50 shadow-lg
  ```

### Bottom Section

Container: `border-t border-gray-100 bg-gray-50/50 flex-shrink-0`.

**Settings link:** identical styling to nav items above, placed in `mx-3` with `py-2.5`.

**Logout button — expanded:**
```
Container:    px-4 py-4
Button:       w-full flex items-center justify-center gap-2
              px-4 py-2.5 rounded-xl text-sm font-medium
              text-red-600 bg-red-50 hover:bg-red-100 transition-colors
Icon:         SignOut w-4 h-4
```

**Logout button — collapsed:**
```
w-full flex justify-center py-3 hover:bg-gray-100 transition-all
Icon: SignOut w-5 h-5 text-red-500
Tooltip: same pattern as nav item tooltips
```

**Version info (expanded only):**
```
Container: px-6 py-3 border-t border-gray-100
Text:      text-xs text-gray-400
Layout:    flex items-center justify-between
Icons:     Question, Info — w-4 h-4, hover:text-gray-600 transition-colors
```

### Animations

| Element       | Animation |
|---------------|-----------|
| Collapse button | `whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}` |
| Logo (collapsed click) | `whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}` |

---

## Sidebar — Mobile

**Same file:** `components/layout/Sidebar.tsx` (MobileSidebar section)

### Layout

- Visible only on mobile (`md:hidden`).
- Drawer slides in from the left.
- Panel width: `w-80` (320px). Full height: `top-0 bottom-0`.
- Z-index: `z-50` (panel), `z-40` (backdrop).
- Background: `bg-white border-r border-gray-200`.

### Backdrop

```
fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden
```

Animate: `opacity: 0 → 1`. Click to close.

### Panel Animation

```javascript
variants: {
  hidden:  { x: '-100%' },
  visible: { x: 0, transition: { type: 'spring', damping: 25, stiffness: 300,
                                   staggerChildren: 0.05, delayChildren: 0.1 } },
  exit:    { x: '-100%', transition: { type: 'spring', damping: 30, stiffness: 300 } }
}
```

### Header

`h-16 flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0 bg-white`

- Logo + gradient text identical to desktop expanded state (`text-xl font-bold`).
- Close button: `p-2 hover:bg-gray-100 rounded-lg transition-colors`.
  - Icon: `X w-5 h-5 text-gray-600 weight="bold"`.
  - Motion: `whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}`.

### User Card

`p-5 border-b border-gray-100 flex-shrink-0 bg-white`

- Avatar: `w-12 h-12 rounded-full p-[2px] bg-gradient-to-r from-violet-500 to-cyan-500`.
- Inner: `rounded-full bg-white`, initials `text-gray-700 font-bold`.

### Navigation Items (mobile)

`flex-1 p-4 overflow-y-auto bg-white`

Section labels: `text-xs font-semibold text-gray-400 tracking-wider mb-2 px-3` (uppercase).

Each item: `flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-all`

```
Active:  bg-gray-100
Default: text-gray-600 hover:bg-gray-50 hover:text-gray-900
```

Active items show `CaretRight w-4 h-4 text-gray-900 weight="bold"` on the right.

**Item animation (stagger):**
```javascript
hidden:  { opacity: 0, x: -20 }
visible: { opacity: 1, x: 0,
           transition: { type: 'spring', damping: 20, stiffness: 300 } }
```

### Footer (mobile)

`p-5 border-t border-gray-100 flex-shrink-0 bg-gray-50`

- Company name + version: `text-xs text-gray-500`.
- Logout button: identical to desktop expanded logout.

---

## Nastavitve — Layout Shell

**File:** `app/nastavitve/layout.tsx`

### Page Structure

```
min-h-screen bg-[#F7F8FA]
  └── max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8
        ├── Header (mb-6)
        ├── Tab Bar (mb-6)
        └── Content
```

### Header Typography

```
h1:   text-2xl sm:text-3xl font-bold text-[#1A1F36]
p:    text-sm text-gray-500 mt-1
```

### Animations (staggered entrance)

```javascript
Header:  initial={{ opacity: 0, y: -10 }}  animate={{ opacity: 1, y: 0 }}
Tabs:    initial={{ opacity: 0, y:  10 }}  animate={{ opacity: 1, y: 0 }}  delay: 0.05
Content: initial={{ opacity: 0, y:  10 }}  animate={{ opacity: 1, y: 0 }}  delay: 0.1
```

---

## Nastavitve — Settings Tab Bar

**File:** `components/settings/SettingsSidebar.tsx`

### Layout

```
Container: flex gap-1 p-1 rounded-xl bg-gray-100 w-full
```

### Tab Item

```
relative flex-1 flex items-center justify-center gap-2
px-4 py-2.5 rounded-lg text-sm font-semibold
transition-all duration-200
```

**Active state:**
```
text-[#1A1F36]
+ animated background: absolute inset-0 bg-white rounded-lg shadow-sm
  layoutId="settings-tab-bg"
  transition: { type: 'spring', stiffness: 400, damping: 30 }
```

**Inactive state:**
```
text-gray-500 hover:text-gray-700
```

### Icons

`w-4 h-4` — `weight="fill"` when active, `weight="regular"` otherwise.

### Tabs

| Label     | Icon         | Visibility  |
|-----------|--------------|-------------|
| Podjetje  | Buildings    | All roles   |
| Splošno   | Gear         | All roles   |
| Člani     | UsersThree   | Owner only  |
| Sporočila | ChatTeardrop | All roles   |

---

## Nastavitve — Shared Components

**Files:** `components/settings/`

### SettingsSection

```
bg-white rounded-xl shadow-sm border border-gray-100
p-4 sm:p-6 mb-6
Animation: opacity: 0, y: 10 → 1, 0 (motion.div)
```

**Title block:**
```
mb-6 pb-4 border-b border-gray-100
Title:       text-lg font-semibold text-gray-900
Description: text-sm text-gray-500 mt-1
```

**Content area:** `space-y-6`

---

### SettingRow

Layout: `flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-8`

```
Label:       text-sm font-medium text-gray-900
Description: text-sm text-gray-500 mt-0.5
Control:     w-full sm:w-72 flex-shrink-0
Error:       text-sm text-red-600 mt-1
```

---

### Input

```
w-full px-4 py-2.5 text-sm text-gray-900 bg-white
border border-gray-200 rounded-lg
placeholder:text-gray-400
transition-colors duration-200

Focus:    focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:ring-opacity-20 focus:outline-none
Error:    border-red-300 focus:ring-red-500 focus:border-red-500
Disabled: bg-gray-50 cursor-not-allowed
```

With `prefix`/`suffix`: absolute positioned `text-gray-500 text-sm`; `pl-8` or `pr-16` on the input.

---

### Switch

```
Outer: relative inline-flex h-6 w-11 items-center rounded-full
       transition-colors duration-200
       focus:ring-2 focus:ring-purple-500 focus:ring-offset-2

ON:    bg-gradient-to-r from-purple-500 to-pink-500
OFF:   bg-gray-200 hover:bg-gray-300
Disabled: opacity-50 cursor-not-allowed

Thumb: inline-block h-4 w-4 rounded-full bg-white shadow-sm
       Animated: x: 22 (on) | x: 4 (off)
       transition: { type: 'spring', stiffness: 500, damping: 30 }
```

---

### TimePicker

```
px-3 py-2 text-sm border border-gray-200 rounded-lg
focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 focus:border-purple-500
transition-colors duration-200
Disabled: opacity-50 cursor-not-allowed bg-gray-50
```

---

### SaveIndicator

Positioned in the page header row (right-aligned).

```
Saving:  text-gray-500 | spinner: CircleNotch w-4 h-4 animate-spin | text-sm
Saved:   text-green-600 | Check w-4 h-4 | text-sm "Shranjeno <time>"
```

Animation: `AnimatePresence mode="wait"` — each state fades `opacity: 0 → 1`.

---

## Nastavitve — Podjetje

**File:** `app/nastavitve/podjetje/page.tsx`

### Page Header

```
flex items-center justify-between mb-6
Title: text-xl font-semibold text-gray-900
Desc:  text-sm text-gray-500 mt-1
```

### Company Info & Contact

Uses `SettingsSection` + `SettingRow` + `Input` components (see Shared Components).

Section titles: "Osnovni podatki", "Kontaktni podatki".

### Working Hours Section

Title: "Delovni čas". Container: `space-y-4`.

**Day card:**
```
border-2 border-gray-200 rounded-xl p-4 space-y-3
```

**Day header row:**
```
flex items-center justify-between
Day name: text-base font-semibold text-gray-900
Toggle:   Switch component (right side)
```

**"Closed" indicator:**
```
text-sm text-gray-400  ("Zaprto")
```

**Time interval row (when enabled):**
```
flex items-center gap-3
  TimePicker — text-gray-500 "–" separator — TimePicker
  Remove button (if >1 interval): p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg
    Icon: X w-4 h-4 weight="bold"
    Motion: whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
```

**Add interval button:**
```
w-full flex items-center justify-center gap-2 px-4 py-2
text-sm font-medium text-violet-600
bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors
Icon: Plus w-4 h-4 weight="bold"
Motion: whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
```

### Save Button

```
flex items-center gap-2 rounded-xl
bg-gradient-to-r from-violet-500 to-cyan-500
px-6 py-3 text-sm font-medium text-white
shadow-lg shadow-violet-500/25
hover:shadow-xl hover:shadow-violet-500/30 transition-shadow
disabled:cursor-not-allowed disabled:opacity-50
Motion: whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
```

Loading state: `SpinnerGap h-4 w-4 animate-spin` + "Shranjujem..." text.
Default state: `FloppyDisk h-4 w-4 weight="bold"` + "Shrani spremembe".

### Loading Skeleton

```
bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse
  h-6 bg-gray-200 rounded w-1/4  (title)
  h-10 bg-gray-100 rounded       (field placeholder)
```

---

## Nastavitve — Splošno

**File:** `app/nastavitve/splosno/page.tsx`

### Page Header

Same pattern as Podjetje: `flex items-center justify-between mb-6`, `text-xl font-semibold`, SaveIndicator on right.

### Locked Fields

Input with `disabled` + `className="bg-gray-50 cursor-not-allowed"`, paired with:
```
flex items-center gap-1 text-gray-400
Lock w-4 h-4 weight="bold"
```

### Company Data — Gradient Card

Outer wrapper:
```
relative p-[2px] rounded-xl
bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500
```

Inner:
```
bg-white rounded-xl p-6 space-y-6
```

**Data value (ID / codes):**
```
text-2xl font-bold
bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600
bg-clip-text text-transparent
```

**Label above value:**
```
text-sm text-gray-600 mb-1
```

**Code descriptions:**
```
text-xs text-gray-500 mb-2
```

**Section label (Admin/Employee):**
```
text-sm font-semibold text-gray-800 mb-0.5
```

**Dividers between code blocks:**
```
border-t border-gray-200
```

**Footer note (bottom of card):**
```
text-xs text-gray-400
```

**Copy button:**
```
p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors
Icon default: Copy w-5 h-5 text-gray-500
Icon copied:  Check w-5 h-5 text-green-500
Motion: whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
```

### QR Code Section

```
flex flex-col items-center gap-3 py-2
Caption: text-sm text-gray-400 text-center
```

### Loading Skeleton

Same as Podjetje; renders 4 skeleton cards instead of 3.

---

## Nastavitve — Člani

**File:** `app/nastavitve/clani/page.tsx`

### Page Container

`space-y-6` — three stacked cards.

### User Limit Banner

```
bg-white rounded-2xl border border-gray-200 px-6 py-4
flex items-center justify-between gap-4
Animation: opacity: 0, y: 8 → 1, 0
```

```
Label: text-sm font-medium text-gray-500
Value: text-2xl font-bold text-[#1A1F36] mt-0.5
```

### Members Card

```
bg-white rounded-2xl border border-gray-200 overflow-hidden
Animation: opacity: 0, y: 8 → 1, 0
```

**Card header:**
```
px-6 py-5 border-b border-gray-100
Title: text-base font-semibold text-[#1A1F36]
Desc:  text-sm text-gray-500 mt-0.5
```

**Member list:**
```
divide-y divide-gray-100
Row: px-6 py-4 flex items-center gap-4
  Name:  text-sm font-semibold text-gray-900 truncate
  Email: text-xs text-gray-500 truncate
```

**Empty state:**
```
px-6 py-10 text-center text-sm text-gray-400
```

### Role Badges

All use `inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold`.

| Role       | Colors |
|------------|--------|
| Lastnik (Owner) | `bg-amber-50 text-amber-700 border border-amber-200` |
| Admin      | `bg-indigo-50 text-indigo-700 border border-indigo-200` |
| Zaposleni (Staff) | `bg-gray-100 text-gray-600 border border-gray-200` |

### Permissions Card

Same card structure. Delay: `transition={{ delay: 0.05 }}`.

**Permission group header:**
```
px-6 py-5 (within divide-y divide-gray-100)
Group label: text-xs font-semibold text-gray-400 tracking-wider uppercase mb-4
```

**Permission row:**
```
flex items-center justify-between gap-4
Label: text-sm text-gray-700
Toggle: PermissionToggle (inline, right side)
```

**PermissionToggle (in-page variant, uses black not gradient):**
```
Outer: relative inline-flex h-6 w-11 items-center rounded-full
       transition-colors duration-200
ON:    bg-black
OFF:   bg-gray-200
Disabled: opacity-50 cursor-not-allowed
Thumb: inline-block h-4 w-4 rounded-full bg-white shadow-sm
       translate-x-6 (on) | translate-x-1 (off)
       transition-transform duration-200
```

### Save Footer (Permissions Card)

```
px-6 py-4 border-t border-gray-100 bg-gray-50
flex items-center justify-between gap-4
```

**Save button:**
```
flex items-center gap-2 px-5 py-2.5 rounded-xl
text-sm font-semibold bg-[#1A1F36] text-white
hover:bg-[#252c48] transition-colors
disabled:opacity-50 disabled:cursor-not-allowed
Loading: CircleNotch w-4 h-4 animate-spin
```

**Success message:**
```
flex items-center gap-1.5 text-emerald-600 font-medium text-sm
Icon: CheckCircle w-4 h-4 weight="fill"
```

**Error message:**
```
flex items-center gap-1.5 text-red-600 text-sm
Icon: Warning w-4 h-4 weight="fill"
```

### Special States

**Access denied (non-owner):**
```
rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center
Animation: opacity: 0, y: 8 → 1, 0
Icon:  Warning w-10 h-10 text-amber-500 mx-auto mb-3 weight="fill"
Title: text-lg font-semibold text-amber-800 mb-1
Desc:  text-sm text-amber-700
```

**Error state:**
```
rounded-2xl bg-red-50 border border-red-200 p-6 text-center
Icon:  Warning w-8 h-8 text-red-500 mx-auto mb-2
Text:  text-sm text-red-700
```

**Loading state:**
```
flex items-center justify-center py-16
GradientSpinner size={32}  (animated, violet→cyan gradient)
```

---

## Nastavitve — Sporočila

**File:** `app/nastavitve/sporocila/page.tsx`

### Page Header

```
flex items-center justify-between mb-6
Title: text-xl font-semibold text-gray-900
Subtitle: text-sm text-gray-500 mt-1 flex items-center gap-1.5
          Icon: Clock w-3.5 h-3.5
```

### Filter Bar

```
mb-5
flex items-center gap-1.5 flex-wrap
Filter icon: Funnel w-4 h-4 text-gray-400 flex-shrink-0
```

**Filter button — inactive:**
```
px-3 py-1.5 rounded-xl text-sm font-medium transition-all
border border-gray-200 text-gray-600 bg-white
hover:border-gray-300 hover:text-gray-800
```

**Filter button — active:**
```
border-transparent text-white shadow-sm
background: linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)
(applied via inline style)
```

### Message Row

```
border border-gray-200 rounded-xl overflow-hidden bg-white
transition-shadow hover:shadow-sm
```

**Row inner:**
```
flex items-center gap-3 p-4
```

**Type label:** `text-sm font-semibold text-gray-900`

**Meta line:**
```
flex items-center gap-2 text-xs text-gray-500 flex-wrap
Recipient: font-medium text-gray-700 truncate max-w-[200px]
Separator: "·"
Time icon: Clock w-3 h-3
```

**Expand/collapse button:**
```
flex-shrink-0 flex items-center gap-1.5
px-3 py-1.5 text-xs font-medium text-gray-600
bg-gray-50 border border-gray-200 rounded-lg
hover:bg-gray-100 transition-colors
Icons: CaretDown / CaretUp w-3.5 h-3.5
```

**Expanded panel animation:**
```javascript
initial={{ height: 0, opacity: 0 }}
animate={{ height: 'auto', opacity: 1 }}
exit:   { height: 0, opacity: 0 }
transition: { duration: 0.2 }
```

**Expanded content:**
```
px-4 pb-4 border-t border-gray-100 pt-3 space-y-3
```

Sub-labels:
```
text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1
```

Content boxes (subject / body):
```
text-sm text-gray-800 bg-gray-50 rounded-lg
px-3 py-2 border border-gray-200
```

Body: `max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word`.

### Badges

All badges: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold` (status) or `font-medium` (channel).

**Status badges:**

| Status  | Colors |
|---------|--------|
| Poslano (sent)  | `bg-emerald-50 text-emerald-700 border border-emerald-200` |
| V vrsti (queued) | `bg-amber-50 text-amber-700 border border-amber-200` |
| Napaka (failed)  | `bg-red-50 text-red-700 border border-red-200` |
| Unknown  | `bg-gray-100 text-gray-600 border border-gray-200` |

**Channel badges:**

| Channel | Colors |
|---------|--------|
| Email | `bg-blue-50 text-blue-700 border border-blue-200` |
| SMS   | `bg-violet-50 text-violet-700 border border-violet-200` |
| Other | `bg-gray-100 text-gray-600 border border-gray-200` |

**Icons:** `w-3.5 h-3.5 weight="fill"` inside each badge.

### Message List

```
space-y-2
Count label: text-xs text-gray-400 mb-3
Animation: opacity: 0 → 1 (motion.div)
```

### Empty State

```
flex flex-col items-center justify-center py-16 text-center
Icon container: w-14 h-14 rounded-full bg-gray-100
                flex items-center justify-center mb-4
Icon:           EnvelopeSimple w-7 h-7 text-gray-400
Primary text:   text-gray-500 font-medium
Secondary text: text-sm text-gray-400 mt-1
```

### Loading Skeleton

```
space-y-3
Each item: border border-gray-200 rounded-xl p-4 animate-pulse bg-white
  flex items-center gap-3
    flex-1 space-y-2
      h-4 bg-gray-200 rounded w-1/3
      h-3 bg-gray-100 rounded w-1/4
    h-8 w-20 bg-gray-100 rounded-lg
```

---

## Design Tokens

### Colors

**Brand / Accent**
```
Primary gradient:   linear-gradient(90deg, #7C75FC 0%, #50C3D2 50%, #44D0C6 100%)
                    (Logo text, "Jedro+")
Violet–Cyan:        from-violet-500 to-cyan-500   (#8B5CF6 → #06B6D4)
                    (Avatar ring, save button, Switch ON, filter active)
Violet–Blue–Cyan:   from-violet-500 via-blue-500 to-cyan-500
                    (Gradient card border)
Indigo–Purple:      from-indigo-500 to-purple-500
                    ("Novo" badge)
Purple–Pink:        from-purple-500 to-pink-500
                    (Switch ON)
Filter active:      linear-gradient(135deg, #8B5CF6, #3B82F6, #06B6D4)
```

**Base Neutrals**
```
#1A1F36             Dark navy — main headings, save button bg
#252c48             Dark navy hover (save button)
#F7F8FA             Page background (nastavitve layout)
White               Sidebar, cards, inputs, panels
```

**Gray Scale (Tailwind)**
```
gray-50             Sidebar bottom bg, input disabled bg, expand button bg
gray-100            Nav active bg, tag pill, section header bg (tab bar)
gray-200            Card borders, dividers, input border, day card border
gray-300            Switch OFF hover, Copy button border hover
gray-400            Section labels, icons default, lock icon, version text
gray-500            Secondary text, descriptions, user email, filter icon
gray-600            Nav item default text, mobile sidebar text
gray-700            Nav hover text, code label, expand button text
gray-800            Strong label text (code names)
gray-900            Primary text, active nav items, input text
```

**Semantic Colors**
```
Emerald-500    Online status dot
Emerald-50/600/700  Success badge, save confirmation
Orange-500     Alert badge (incomplete settings), nav dot
Amber-50/200/500/700/800  Warning / owner badge / access denied
Red-50/100/300/500/600/700  Error, delete, logout
Violet-50/100/600  Working hours interval button
Blue-50/200/700  Email channel badge
Violet-50/200/700  SMS channel badge
Indigo-50/200/700  Admin role badge
```

### Border Radius

```
rounded-lg      8px   — inputs, time pickers, tooltips, expand buttons
rounded-xl      12px  — nav items, cards (settings sections), buttons
rounded-2xl     16px  — cards (člani, metric banner)
rounded-full    9999px — badges, avatar, dots
```

### Shadows

```
shadow-sm               Light card shadow (SettingsSection, active tab)
shadow-lg               Tooltip, collapsed nav
shadow-2xl              Mobile sidebar panel
shadow-lg shadow-violet-500/25   Save gradient button
shadow-xl shadow-violet-500/30   Save gradient button (hover)
```

### Typography

| Usage | Classes |
|-------|---------|
| Page heading | `text-2xl sm:text-3xl font-bold text-[#1A1F36]` |
| Section page title | `text-xl font-semibold text-gray-900` |
| Card title | `text-base font-semibold text-[#1A1F36]` |
| Section heading | `text-lg font-semibold text-gray-900` |
| Nav section label | `text-[11px] font-semibold text-gray-400 tracking-wider` |
| Permission group | `text-xs font-semibold text-gray-400 tracking-wider uppercase` |
| Badge text | `text-xs font-semibold` or `text-xs font-medium` |
| Body / description | `text-sm text-gray-500` |
| Labels | `text-sm font-medium text-gray-900` |
| Small meta | `text-xs text-gray-500` |
| Tiny / version | `text-xs text-gray-400` |
| Large ID values | `text-2xl font-bold` (gradient fill) |

### Spacing (Key Values)

```
Section gap:        mb-6 (between layout regions)
Card padding:       p-4 sm:p-6
Card inner:         space-y-6
Row layout gap:     sm:gap-8
Nav item padding:   px-3 py-2.5 (desktop), px-3 py-3 (mobile)
Avatar:             w-11/w-12 h-11/h-12
Badge padding:      px-2.5 py-1
Button padding sm:  px-3 py-1.5
Button padding md:  px-4 py-2.5
Button padding lg:  px-6 py-3
```

### Motion Library

All animations use **Framer Motion v12** imported as `motion/react`.

| Pattern | Usage |
|---------|-------|
| `type: 'spring', damping: 25, stiffness: 300` | Mobile sidebar slide |
| `type: 'spring', damping: 30, stiffness: 300` | MobileSidebar (legacy) |
| `type: 'spring', stiffness: 400, damping: 30` | Settings tab bg slide |
| `type: 'spring', stiffness: 500, damping: 30` | Switch thumb |
| `type: 'spring', damping: 20, stiffness: 300` | Nav item stagger |
| `staggerChildren: 0.05, delayChildren: 0.1` | Sidebar nav entrance |
| `duration: 0.2` | Message row expand/collapse |
| `whileHover/whileTap scale` | Buttons (1.02/0.98, 1.05/0.95, 1.1/0.9) |
| `layoutId="settings-tab-bg"` | Shared layout animation for tab indicator |
| `AnimatePresence mode="wait"` | SaveIndicator state transitions |
