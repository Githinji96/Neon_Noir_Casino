# Implementation Plan

## Overview

This plan follows the exploratory bugfix methodology for the `empty-phone-numbers` bug. Tasks are ordered: surface the bug first (exploration test), lock down preserved behavior second (preservation tests), then apply the three-file fix, and finally validate everything passes.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "wave": 4, "tasks": ["3.4", "3.5"] },
    { "wave": 5, "tasks": ["4"] }
  ]
}
```

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - AuthModal Signup Calls signUp Without Phone
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that `AuthModal` in signup mode calls `signUp()` inline instead of redirecting
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — any valid email/password/username combination submitted via `AuthModal` in `signup` mode
  - Mount `AuthModal` with `isOpen=true`; simulate filling email, password, and username fields, then submit
  - Assert that `authStore.signUp()` is called with no phone argument (or `phone` is `undefined`/`''`)
  - Assert that `navigate('/auth/signup')` was NOT called (no redirect occurs on unfixed code)
  - Assert that `onClose()` was NOT called as part of a redirect sequence
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS because the bug means `signUp()` IS called instead of redirecting (test asserts redirect happened, which it didn't)
  - Document counterexamples found: e.g. `AuthModal signup with email=test@example.com calls signUp() directly — phone is absent from call args`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Signup-Modal Paths Are Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observation step 1 — AuthModal signin**: Mount `AuthModal` in `signin` mode, fill email/password, submit on UNFIXED code → observe `signIn()` is called with the correct args and `onClose()` fires on success
  - **Observation step 2 — SettingsModal phone button (non-null phone)**: Mount `SettingsModal` with `profile.phone = '254712345678'` on UNFIXED code → observe that a "Change" or equivalent button is NOT present next to "Registered Number" (captures current absence, which the fix will add — document this observation carefully)
  - **Observation step 3 — ChangeMpesaModal same-number guard**: Open `ChangeMpesaModal` with `profile.phone = '254712345678'`, enter the same number + correct password → observe "must be different from the current one" error fires; verify test PASSES on unfixed code
  - **Observation step 4 — SignUpPage registration**: Mount `SignUpPage` (or simulate its `handleSubmit`), submit a complete form including a valid Kenyan phone → observe `signUp()` is called with all arguments including a normalised `2547XXXXXXXX` phone; verify test PASSES on unfixed code
  - Write property-based test: for all valid `(email, password)` pairs submitted to `AuthModal` in `signin` mode, `signIn()` is always called with those exact args and no redirect to `/auth/signup` occurs
  - Write property-based test: for all non-null `profile.phone` values, `ChangeMpesaModal` raises "must be different from current one" when the same normalised number is re-entered
  - Verify all preservation tests PASS on UNFIXED code before proceeding
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for empty phone numbers on AuthModal signup

  - [x] 3.1 Redirect AuthModal signup branch to SignUpPage
    - In `src/components/AuthModal.tsx`, import `useNavigate` from `react-router-dom` and initialise `const navigate = useNavigate();` inside the component
    - In `handleSubmit`, replace the `else` branch (signup mode) that calls `signUp(email, password, username)` with: `navigate('/auth/signup'); onClose();`
    - Replace the `<button>` that switches `mode` to `'signup'` with a call to `navigate('/auth/signup'); onClose();` so the "Sign up" toggle also routes directly to `SignUpPage`
    - Remove the now-unused `username` state and its `<input>` in signup mode (or replace the signup branch UI with a brief redirect prompt + "Go to Sign Up" button for clarity)
    - Remove the `signUp` import from `useAuthStore` if it is no longer needed within the modal
    - _Bug_Condition: isBugCondition(X) where X.registrationPath = "AuthModal" AND X.mode = "signup"_
    - _Expected_Behavior: result.action = "redirect" AND result.destination = "/auth/signup" AND signUp NOT called_
    - _Preservation: signin via AuthModal unchanged; SignUpPage registration unchanged; handle_new_user trigger unaffected_
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Surface "Add Number" / "Change" button in SettingsModal
    - In `src/components/SettingsModal.tsx`, locate the Account tab's "Registered Number" `<Row>` element
    - Add a button immediately after the phone display span that calls `setChangeMpesaOpen(true)`
    - Label the button conditionally: render `"Add Number"` when `!profile?.phone`, render `"Change"` when `profile?.phone` is set
    - Style consistently with the panel (small, `font-orbitron`, `text-xs`, yellow/subtle variant)
    - `changeMpesaOpen` state and `<ChangeMpesaModal>` are already wired — no new state or imports needed
    - _Bug_Condition: isBugCondition(X) where existing null-phone user has no self-service path_
    - _Expected_Behavior: SettingsModal renders "Add Number" button for null-phone profiles; clicking it opens ChangeMpesaModal_
    - _Preservation: "Change" button renders and opens ChangeMpesaModal for users who already have a phone set_
    - _Requirements: 2.4, 3.1_

  - [x] 3.3 Fix ChangeMpesaModal first-time-add guard
    - In `src/components/ChangeMpesaModal.tsx`, locate the `if (normalizedNew === currentPhone)` validation block inside `handleSubmit`
    - Wrap the guard so it only executes when `currentPhone` is non-empty:
      ```ts
      // Before
      if (normalizedNew === currentPhone) {
        setError('Your new M-Pesa number must be different from the current one.');
        return;
      }
      // After
      if (currentPhone && normalizedNew === currentPhone) {
        setError('Your new M-Pesa number must be different from the current one.');
        return;
      }
      ```
    - No other logic in `ChangeMpesaModal` needs to change; audit logging, uniqueness check, password verification, and 24-hour hold all remain intact
    - _Bug_Condition: currentPhone = '' AND user attempts first-time phone addition_
    - _Expected_Behavior: guard is skipped when currentPhone is empty; submission proceeds to password verification_
    - _Preservation: guard still fires correctly when currentPhone is non-empty and the same number is re-entered_
    - _Requirements: 2.4, 3.1_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - AuthModal Signup Redirects to SignUpPage
    - **IMPORTANT**: Re-run the SAME test written in task 1 — do NOT write a new test
    - The test from task 1 asserts that `navigate('/auth/signup')` was called and `signUp()` was NOT called
    - When this test passes, it confirms the redirect fix is correct for all inputs satisfying the bug condition
    - Run the exploration test suite on the FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — `AuthModal` now redirects instead of calling `signUp` inline)
    - _Requirements: 2.1, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Signup-Modal Paths Are Unchanged
    - **IMPORTANT**: Re-run the SAME tests written in task 2 — do NOT write new tests
    - Run all preservation property tests on the FIXED code
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions — signin via `AuthModal`, `SignUpPage` registration, `ChangeMpesaModal` same-number guard for existing phones, and `refreshBalance` backfill are all unaffected)
    - Confirm every preservation scenario still behaves identically to the unfixed code

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm every test (exploration + preservation) is green
  - Manually smoke-test the end-to-end flows in the browser:
    - Click "Sign Up" on the homepage → confirm redirect to `/auth/signup`
    - Sign in via `AuthModal` → confirm normal authentication, no redirect
    - Open Settings as a null-phone user → confirm "Add Number" button is visible → click it → confirm `ChangeMpesaModal` opens and a new phone can be saved
    - Open Settings as a user with a phone → confirm "Change" button is visible → confirm `ChangeMpesaModal` still rejects the same phone with "must be different" error
  - Ask the user if any questions arise before marking this task complete

## Notes

- Tasks 1 and 2 MUST be executed against the **unfixed** code. Do not apply any code changes before both tests are written and their expected outcomes (task 1 FAILS, task 2 PASSES) are confirmed.
- The three implementation sub-tasks (3.1, 3.2, 3.3) are independent of each other and can be applied in any order, but all must be complete before running 3.4 and 3.5.
- No database migrations are required — all changes are confined to three frontend component files.
- `ChangeMpesaModal` already handles audit logging, password verification, uniqueness checking, and the 24-hour withdrawal hold; those paths are untouched.
- Property-based tests should use a library already present in the project (check `package.json`); if none is available, use `fast-check` (install with exact version pin).
