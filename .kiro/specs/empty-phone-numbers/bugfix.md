# Bugfix Requirements Document

## Introduction

Users who register through the homepage `AuthModal` end up with no phone number in the admin Users panel (displayed as "—"). The modal's signup flow only collects email, password, and username — it never prompts for an M-Pesa number and passes `phone: undefined` to `signUp()`. Because `raw_user_meta_data->>'phone'` is empty, the `handle_new_user` DB trigger creates the profile row with `phone = NULL`. The full `SignUpPage` at `/auth/signup` correctly collects and normalises the phone before calling `signUp()`, so its users are unaffected.

The fix is two-pronged:
1. **Future signups** — The `AuthModal` signup branch redirects to `SignUpPage` instead of registering inline, ensuring every new user goes through the complete form.
2. **Existing users** — Users who already registered via the modal (and have `phone = NULL`) need a way to add their phone number retroactively, either through a profile-settings page or the admin panel.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits the signup form in `AuthModal` (homepage modal) THEN the system calls `signUp(email, password, username)` with no phone argument, storing `phone: ''` in `raw_user_meta_data`

1.2 WHEN the `handle_new_user` DB trigger fires for an `AuthModal` registrant THEN the system creates the profile row with `phone = NULL` because `raw_user_meta_data->>'phone'` is empty

1.3 WHEN an admin views the Users panel THEN the system displays "—" for the phone number of every user who registered via `AuthModal`

1.4 WHEN the existing backfill migration (`backfill_phone_from_metadata.sql`) runs against an `AuthModal` registrant THEN the system cannot backfill their phone because `raw_user_meta_data->>'phone'` was never populated

### Expected Behavior (Correct)

2.1 WHEN a user clicks "Sign up" in `AuthModal` THEN the system SHALL redirect the user to `SignUpPage` (`/auth/signup`) instead of registering inline, ensuring phone collection is mandatory

2.2 WHEN a user completes the full `SignUpPage` registration form THEN the system SHALL store a normalised M-Pesa number (format `2547XXXXXXXX`) in `raw_user_meta_data->>'phone'` and in the `profiles.phone` column

2.3 WHEN an admin views the Users panel for any user registered after this fix THEN the system SHALL display a non-empty phone number

2.4 WHEN an existing user with `phone = NULL` visits their profile settings THEN the system SHALL allow them to enter and save an M-Pesa phone number so their profile can be updated

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user signs in through `AuthModal` (signin mode) THEN the system SHALL CONTINUE TO authenticate the user normally without any redirect

3.2 WHEN a user registers through `SignUpPage` THEN the system SHALL CONTINUE TO collect, normalise, and store their phone number exactly as before

3.3 WHEN the `handle_new_user` DB trigger fires for a `SignUpPage` registrant THEN the system SHALL CONTINUE TO populate `profiles.phone` correctly from `raw_user_meta_data->>'phone'`

3.4 WHEN an admin updates a user's phone number via the admin Users panel THEN the system SHALL CONTINUE TO persist that change to the `profiles` table

3.5 WHEN a user's session is active and `refreshBalance` runs THEN the system SHALL CONTINUE TO patch `profiles.phone` from auth metadata if the phone was previously missing and metadata has a value

---

## Bug Condition Pseudocode

**Bug Condition Function** — identifies the inputs that trigger the bug:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type RegistrationRequest
  OUTPUT: boolean

  // The bug fires when a signup is submitted via AuthModal,
  // which never collects or forwards a phone number
  RETURN X.registrationPath = "AuthModal"
     AND X.mode = "signup"
END FUNCTION
```

**Fix-Checking Property** — desired behavior for buggy inputs:

```pascal
// Property: Fix Checking — AuthModal signup no longer registers inline
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleAuthModalSignup'(X)
  ASSERT result.action = "redirect"
     AND result.destination = "/auth/signup"
     AND no_profile_row_created_without_phone(result)
END FOR
```

**Preservation Property** — non-buggy inputs must behave identically before and after the fix:

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // i.e. signin via AuthModal, registration via SignUpPage,
  // and all admin operations are unaffected
END FOR
```
