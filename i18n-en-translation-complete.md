# English Translation — common + auth complete

## Stats
- common.json: 52 strings translated
- auth.json: 67 strings translated
- Total: 119 strings

## Notable Translation Decisions

1. **`checkEmail.heading` + `headingHighlight`** — The SL splits "Na vaš email smo poslali / potrditveno povezavo" across two keys for highlighted rendering. Translated as "We've sent you a" + "confirmation link" to preserve the split structure while reading naturally as one sentence.

2. **`confirmError.headingHighlight`** — "ni veljavna" is a predicate fragment meaning "is not valid." Rather than a standalone adjective, kept as "isn't valid" so it composes correctly with `heading: "Verification link"` → "Verification link **isn't valid**."

3. **`signup.fullNamePlaceholder`** — "Janez Novak" is a Slovenian placeholder name. Replaced with "Jane Smith" — a neutral English equivalent. No functional impact, just removes locale leakage in the UI.

4. **`buttons.discard`** — SL "Razveljavi" is literally "undo/revert." Translated to "Undo" per the lookup table rather than "Discard" (which implies irreversible deletion), keeping it consistent with common UI conventions.

5. **`forgotPassword.success.message`** — The SL is a full literal sentence. Rewrote as "If an account with that email exists, we've sent you a password reset link. Check your spam folder too." — tightened to modern SaaS pattern (security-aware hedging, brevity, no "junk mail" phrasing).

## Verified
- ✅ No [EN PENDING] markers remain
- ✅ JSON valid
- ✅ TypeScript: no errors
- ✅ Committed: 2b7efe8
