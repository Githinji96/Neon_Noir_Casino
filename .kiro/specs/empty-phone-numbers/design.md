# Empty Phone Numbers Bugfix Design

## Overview

Users who register through the homepage `AuthModal` end up with `profiles.phone = NULL` because the modal's signup branch never collects a phone number and calls `signUp(email, password, username)` with `phone: undefined`. The `handle_new_user` DB trigger therefore creates the profile row with no phone, making the admin Users panel show "—" for every modal registrant.

The fix is two-pronged and entirely contained within the frontend:

1. **Future signups** — The `AuthModal` signup branch is redirected to `SignUpPage` (`/auth/signup`) instead of registering inline. This guarantees every new user goes through the full form, which mandates and normalises an M-Pesa number.
2. **Existing users** — A button is surfaced in `SettingsModal` (Account tab → M-Pesa section) that opens the already-implemented `ChangeMpesaModal`. A minor guard fix in `ChangeMpesaModal` ensures that a user with `phone = NULL` can add a first-time number (the "same as current" check is skipped when `currentPhone` is empty).

No database migrations, no new components, and no changes to `SignUpPage` or `authStore` are required.

---

## Glossary

- **Bug_Condition (C)**: The condition that identifies the defective code path — a signup submitted via `AuthModal` (which omits the phone number entirely).
- **Property (P)**: The desired outcome for inputs satisfying C — `AuthModal` in signup mode SHALL redirect to `SignUpPage` rather than calling `signUp()` inline, so no profile row is ever created without a phone.
- **Preservation**: The set of existing behaviours that must remain unchanged after the fix — signin via `AuthModal`, registration via `SignUpPage`, all admin operations, `refreshBalance` backfill logic, etc.
- **`AuthModal`**: The overlay component (`src/components/AuthModal.tsx`) that provides both sign-in and sign-up UI from the homepage. Its signup branch is the root cause of the bug.
- **`SignUpPage`**: The dedicated registration page (`src/pages/auth/SignUpPage.tsx`) at `/auth/signup`. It collects a validated, normalised M-Pesa number and passes it to `signUp()`.
- **`ChangeMpesaModal`**: The password-verified phone-change component (`src/components/ChangeMpesaModal.tsx`). Already fully implemented; used to let existing null-phone users add their number retroactively.
- **`SettingsModal`**: The slide-out settings panel (`src/components/SettingsModal.tsx`). Has `changeMpesaOpen` state and `<ChangeMpesaModal>` already wired but no button to open it.
- **`normalizeKenyanPhone`**: A pure utility in `src/services/authSchemas.ts` that maps any Kenyan phone format to the canonical `2547XXXXXXXX` string.
- **`handle_new_user` trigger**: A Supabase DB trigger that creates a `profiles` row from `raw_user_meta_data` on every new auth signup. It reads `raw_user_meta_data->>'phone'`; if that field is empty, `profiles.phone` is set to `NULL`.
- **`registrationPath`**: The conceptual input dimension distinguishing "arrived via `AuthModal`" from "arrived via `SignUpPage`". The bug condition depends solely on this dimension.

---

## Bug Details

### Bug Condition

The bug manifests when a user submits the "Create Account" form inside `AuthModal`. The modal collects only `username`, `email`, and `password` — it never presents a phone field. Its `handleSubmit` function calls:

```ts
err = await signUp(email, password, username);   // phone is undefined → ''
```

Because `phone` is omitted, `signUp()` passes `phone: ''` in `raw_user_meta_data`, so the `handle_new_user` trigger sets `profiles.phone = NULL`.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type RegistrationRequest
  OUTPUT: boolean

  // The bug fires exclusively when the signup is submitted via AuthModal,
  // which never collects or forwards a phone number.
  RETURN X.registrationPath = "AuthModal"
     AND X.mode             = "signup"
END FUNCTION
```

### Examples

- **Example 1 — AuthModal signup (BUG)**: A visitor on the homepage clicks "Sign Up", enters username/email/password, and submits. `signUp()` is called with `phone = undefined`. The `handle_new_user` trigger creates `profiles.phone = NULL`. Admin panel shows "—".
- **Example 2 — SignUpPage signup (no bug)**: A visitor navigates to `/auth/signup`, fills the full form including M-Pesa number, and submits. `signUp()` is called with `phone = "2547XXXXXXXX"`. Admin panel shows the number correctly.
- **Example 3 — AuthModal signin (no bug)**: A returning user signs in via the modal. No profile row is created; `phone` is not touched. Unaffected by the fix.
- **Edge case — existing modal registrant adds phone via SettingsModal**: A user registered before the fix has `profile.phone = NULL`. They open Settings → Account → click "Add Number". `ChangeMpesaModal` opens, they enter and verify their number. `profiles.phone` is updated. Admin panel now shows their number.

---

## Expected Behavior

### Preservation Requirements

These behaviors must be completely unchanged after the fix:

**Unchanged Behaviors:**
- Sign-in through `AuthModal` must continue to authenticate the user normally, with no redirect.
- Registration via `SignUpPage` must continue to collect, normalise, and store the phone number exactly as before (belt-and-braces patch loop intact).
- The `handle_new_user` trigger must continue to populate `profiles.phone` correctly for `SignUpPage` registrants whose `raw_user_meta_data->>'phone'` is non-empty.
- Admin updates to a user's phone number via the Users panel must continue to persist to the `profiles` table.
- `refreshBalance()` must continue to backfill `profiles.phone` from auth metadata when the profile phone is null but metadata has a value.
- `ChangeMpesaModal` must continue to enforce password verification, uniqueness checks, the 24-hour withdrawal hold, and audit logging for all phone changes.
- The `SettingsModal` "Registered Number" display (masked format) must continue to render correctly for users who already have a phone number.

**Scope:**

All inputs where `isBugCondition(X)` is false must be completely unaffected. This includes:
- Any interaction with `AuthModal` in `signin` mode
- Any registration that arrives via `SignUpPage`
- All admin-panel operations on the `profiles` table
- All `ChangeMpesaModal` interactions by users who already have a phone number set

---

## Hypothesized Root Cause

Based on the bug description and source-code review, the causes are well-understood (no ambiguity):

1. **`AuthModal` never collects phone**: The modal form has fields for `username`, `email`, and `password` only. There is no phone input. This is the primary root cause — the data is never gathered so it cannot be passed downstream.

2. **`signUp()` called with `phone = undefined`**: `authStore.signUp()` accepts `phone?` as an optional fourth argument. When `AuthModal` calls `signUp(email, password, username)`, `phone` is `undefined`, which the store maps to `''` in `raw_user_meta_data`.

3. **DB trigger reads empty string as no-phone**: The `handle_new_user` trigger reads `raw_user_meta_data->>'phone'`. An empty string evaluates as falsy / null in typical PL/pgSQL logic, so `profiles.phone` is inserted as `NULL`.

4. **`SettingsModal` has no button to open `ChangeMpesaModal`**: The state variable `changeMpesaOpen` and the `<ChangeMpesaModal>` component are already wired in `SettingsModal.tsx`, but `setChangeMpesaOpen(true)` is never called from any UI element. Existing null-phone users have no self-service path to add their number.

5. **`ChangeMpesaModal` "same number" guard incorrectly blocks first-time add**: The guard `if (normalizedNew === currentPhone)` short-circuits with an error when `currentPhone` is `''` and the user tries to add any number that normalises to `''` — or more precisely, it would allow adding (since the new number will be non-empty), but the `currentPhone` derived from `normalizeKenyanPhone('')` is an empty string. The guard text says "must be different from the current one", which is misleading/wrong when there is no current number. The guard should be skipped entirely when `currentPhone` is empty.

---

## Correctness Properties

Property 1: Bug Condition — AuthModal Signup Redirects to SignUpPage

_For any_ registration request where the bug condition holds (`isBugCondition(X)` returns true — i.e., the user initiates signup through `AuthModal`), the fixed `AuthModal` SHALL navigate the user to `/auth/signup` instead of calling `signUp()` inline, ensuring no profile row is created without a phone number via this path.

**Validates: Requirements 2.1, 2.3**

Property 2: Preservation — Non-Modal-Signup Paths Are Unchanged

_For any_ input where the bug condition does NOT hold (`isBugCondition(X)` returns false — i.e., sign-in via `AuthModal`, registration via `SignUpPage`, admin operations, settings interactions by users with existing phones), the fixed code SHALL produce exactly the same behavior as the original code, preserving all authentication flows, phone storage logic, and admin functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

Assuming the root cause analysis above is correct:

**File 1: `src/components/AuthModal.tsx`**

**Specific Changes:**
1. **Import `useNavigate`**: Add `import { useNavigate } from 'react-router-dom';` and call `const navigate = useNavigate();` inside the component.
2. **Replace inline signup in `handleSubmit`**: In the `else` branch (signup mode), delete the `signUp()` call and replace it with `navigate('/auth/signup'); onClose();`. The loading state and validation guard for username can be removed since the form will not be submitted here anymore.
3. **Redirect "Sign up" toggle link**: The `<button>` that calls `setMode(... 'signup' ...)` when in signin mode should instead call `navigate('/auth/signup'); onClose();` so clicking "Sign up" from the modal goes directly to the full page.
4. **Remove now-unused signup-mode form fields**: The `username` state and its `<input>` in signup mode can be removed, since the modal will no longer submit a signup. Alternatively, the entire signup branch of the form can be replaced with a redirect message/button. A clean approach is: when `mode === 'signup'`, render only a prompt + a "Go to Sign Up page" button.

**File 2: `src/components/SettingsModal.tsx`**

**Specific Changes:**
1. **Add button to the "Registered Number" row**: In the Account tab's M-Pesa section, add a button next to the "Registered Number" row that calls `setChangeMpesaOpen(true)`. Label it conditionally: "Add Number" when `profile?.phone` is null/empty/falsy, "Change" when a phone exists.

**File 3: `src/components/ChangeMpesaModal.tsx`**

**Specific Changes:**
1. **Guard the "same as current" check**: Wrap the `if (normalizedNew === currentPhone)` block so it only executes when `currentPhone` is non-empty. When `currentPhone` is `''` (user has no phone), this check must be skipped entirely to allow a first-time phone addition.

   Before:
   ```ts
   if (normalizedNew === currentPhone) {
     setError('Your new M-Pesa number must be different from the current one.');
     return;
   }
   ```

   After:
   ```ts
   if (currentPhone && normalizedNew === currentPhone) {
     setError('Your new M-Pesa number must be different from the current one.');
     return;
   }
   ```

---

## Testing Strategy

### Validation Approach

The testing strategy follows the two-phase bug condition methodology: first surface counterexamples that prove the bug exists on the unfixed code (exploratory checking), then verify the fix works for all buggy inputs (fix checking) and that all non-buggy inputs are preserved (preservation checking).

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis. If the analysis is wrong, re-hypothesize.

**Test Plan**: Mount `AuthModal` with `mode = 'signup'`, simulate a form submission, and assert that `authStore.signUp()` was called with `phone = undefined` or `phone = ''`. Also assert that a navigate call was NOT made. Run against the unfixed code to observe the defect.

**Test Cases**:
1. **AuthModal signup calls signUp without phone** (will demonstrate bug on unfixed code): Mount `AuthModal`, fill email/password/username, submit → assert `signUp` was called with `phone` argument `undefined` or absent.
2. **AuthModal signup does not redirect** (will demonstrate bug on unfixed code): Mount `AuthModal`, attempt signup → assert `navigate('/auth/signup')` was NOT called (no redirect happens).
3. **SettingsModal has no Add Number button** (will demonstrate bug on unfixed code): Mount `SettingsModal` with a profile where `phone = null` → assert no button with text "Add Number" or "Change" is rendered.
4. **ChangeMpesaModal blocks first-time add** (may demonstrate bug on unfixed code): Open `ChangeMpesaModal` with `profile.phone = null`, enter a valid new phone + confirm + password → assert the "same as current" error does NOT appear (verify current behaviour before fixing).

**Expected Counterexamples**:
- `signUp` is invoked with no phone argument when submitting `AuthModal` in signup mode
- No navigation to `/auth/signup` occurs from `AuthModal` signup path
- `SettingsModal` renders "—" with no interactive button beside it for null-phone users

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := authModal_fixed.handleSubmit(X)
  ASSERT result.action      = "navigate"
     AND result.destination = "/auth/signup"
     AND signUp_was_NOT_called(result)
END FOR
```

**Test Cases**:
1. **Redirect on signup submit**: Submit `AuthModal` signup form → assert `navigate('/auth/signup')` was called and `signUp()` was NOT called.
2. **Modal closes on redirect**: Submit `AuthModal` signup form → assert `onClose()` was invoked.
3. **"Sign up" link navigates**: Click the "Sign up" toggle in `AuthModal` → assert `navigate('/auth/signup')` was called (not a mode switch).

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT authModal_original(X) = authModal_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (email formats, password lengths, etc.)
- It catches edge cases that manual tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on the UNFIXED code for signin interactions first, then write tests capturing that behavior to verify they still pass after the fix.

**Test Cases**:
1. **Signin via AuthModal unchanged**: Fill `AuthModal` in signin mode, submit → assert `signIn()` is called with correct email/password and `onClose()` is called on success. Must behave identically before and after the fix.
2. **SignUpPage registration unchanged**: Navigate to `/auth/signup`, fill the full form → assert `signUp()` is called with all seven arguments including a normalised phone. The belt-and-braces patch loop must still execute.
3. **SettingsModal shows Change button for phone-present users**: Mount `SettingsModal` with `profile.phone = '254712345678'` → assert a "Change" button is rendered next to "Registered Number" and clicking it opens `ChangeMpesaModal`.
4. **ChangeMpesaModal enforces different-number guard when phone exists**: Open `ChangeMpesaModal` with `profile.phone = '254712345678'`, enter the same number → assert the "must be different from the current one" error fires.
5. **refreshBalance backfill unchanged**: Simulate a profile with `phone = null` but auth metadata `phone = '254712345678'` → assert `refreshBalance()` patches `profiles.phone` via Supabase update.

---

### Unit Tests

- Test `AuthModal` in signup mode: verify `navigate('/auth/signup')` is called and `signUp` is NOT called
- Test `AuthModal` in signin mode: verify `signIn()` is called normally (preservation)
- Test `SettingsModal` Account tab with `profile.phone = null`: verify "Add Number" button is rendered
- Test `SettingsModal` Account tab with `profile.phone = '254712345678'`: verify "Change" button is rendered
- Test `ChangeMpesaModal` with null `currentPhone`: verify "same as current" guard is skipped and submission proceeds to password verification
- Test `ChangeMpesaModal` with non-null `currentPhone` and same number entered: verify "same as current" error is shown

### Property-Based Tests

- Generate random valid Kenyan phone strings; verify `normalizeKenyanPhone` always produces a 12-digit string starting with `254` (existing utility, no change needed — regression guard)
- Generate random email/password pairs; mount fixed `AuthModal` in signup mode and verify `signUp` is NEVER called regardless of input — it always redirects
- Generate random profile states (`phone` null or non-null); verify `SettingsModal` Account tab always renders either "Add Number" or "Change" button (never neither)

### Integration Tests

- Full registration flow via `AuthModal`: click "Sign Up" on homepage → assert browser navigates to `/auth/signup` → complete full form → assert profile row created with non-null phone
- Existing null-phone user adds phone via `SettingsModal`: sign in as a pre-fix modal registrant → open Settings → click "Add Number" → complete `ChangeMpesaModal` → assert `profiles.phone` updated in DB and masked number displayed in settings
- Sign-in flow regression: sign in via `AuthModal` → assert user is authenticated, no redirect, no disruption to session or profile
