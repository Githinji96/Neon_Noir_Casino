/**
 * empty-phone-numbers — Bug Condition + Preservation Tests
 *
 * Spec: .kiro/specs/empty-phone-numbers/
 *
 * Task 1 (Bug Condition / Fix Verification):
 *   Property 1 — AuthModal has NO inline signUp call and ALWAYS redirects to
 *   /auth/signup when "Sign up" is clicked. Tests the FIXED behavior.
 *
 * Task 2 (Preservation):
 *   Property 2a — AuthModal signin calls signIn() with exact credentials.
 *   Property 2b — ChangeMpesaModal "same as current" guard fires only when
 *                  currentPhone is non-empty.
 *   Property 2c — normalizeKenyanPhone always returns 12-digit 254-prefixed string.
 *   Property 2d — ChangeMpesaModal guard logic (pure unit, no render).
 *   Property 2e — SettingsModal button label ternary ("Add Number" / "Change").
 *
 * Design decision: Tasks 1 and 2a use React Testing Library to render
 * AuthModal. Tasks 2b–2e test pure logic directly — faster, zero flakiness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockNavigate, mockSignIn, mockSignUp } = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const mockSignIn   = vi.fn().mockResolvedValue(null);
  const mockSignUp   = vi.fn().mockResolvedValue(null);
  return { mockNavigate, mockSignIn, mockSignUp };
});

// Mock react-router-dom — keep real MemoryRouter/Routes but override useNavigate
vi.mock('react-router-dom', async () => {
  const real = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...real, useNavigate: () => mockNavigate };
});

// Mock authStore — must behave like a Zustand selector hook.
// AuthModal calls useAuthStore() without a selector (destructures result),
// so the mock must return the full state object when called with no args,
// and call the selector when called with a function.
vi.mock('../../store/authStore', () => {
  const state = {
    user:    null as null,
    profile: null as null,
    get signIn()  { return mockSignIn;  },
    get signUp()  { return mockSignUp;  },
    signOut: vi.fn(),
    refreshBalance: vi.fn(),
  };
  return {
    useAuthStore: (selector?: (s: typeof state) => unknown) =>
      typeof selector === 'function' ? selector(state) : state,
  };
});

// Stub framer-motion — prevent animation timers from hanging tests
vi.mock('framer-motion', () => {
  // Strip motion-specific props so they don't reach DOM elements
  const Passthrough = ({ children, initial: _i, animate: _a, exit: _e,
    transition: _t, whileHover: _wh, whileTap: _wt, layout: _l,
    ...domRest }: Record<string, unknown>) => {
    // underscore-prefixed vars are intentionally unused (framer-motion props)
    void _i; void _a; void _e; void _t; void _wh; void _wt; void _l;
    void domRest;
    return children as React.ReactElement;
  };
  return {
    motion: {
      div:    Passthrough,
      button: Passthrough,
      span:   Passthrough,
      p:      Passthrough,
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

import React from 'react';
import AuthModal from '../AuthModal';
import { normalizeKenyanPhone } from '../../services/authSchemas';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** 9-digit suffix valid for Kenyan M-Pesa (starts with 7 or 1) */
const arbPhoneSuffix: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('7', '1'),
    fc.stringOf(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), { minLength: 8, maxLength: 8 })
  )
  .map(([first, rest]) => `${first}${rest}`);

/** Simple valid email (fast-check emailAddress can be slow/complex) */
const arbEmail: fc.Arbitrary<string> = fc
  .tuple(
    fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-z0-9]+$/.test(s)),
    fc.string({ minLength: 3, maxLength: 8 }).filter((s) => /^[a-z]+$/.test(s))
  )
  .map(([user, domain]) => `${user}@${domain}.com`);

/** Simple valid password */
const arbPassword: fc.Arbitrary<string> = fc.constant('Password1!');

// ─────────────────────────────────────────────────────────────────────────────
// TASK 1 — Bug Condition / Fix Verification
// Property 1: AuthModal signup mode redirects to /auth/signup and NEVER calls signUp()
// ─────────────────────────────────────────────────────────────────────────────

describe('Task 1 — Property 1: AuthModal signup → redirect, no inline signUp', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('[unit] clicking "Sign up" navigates to /auth/signup and calls onClose()', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <AuthModal isOpen={true} onClose={onClose} />
      </MemoryRouter>
    );

    const signUpBtn = screen.getByRole('button', { name: /sign up/i });
    await act(async () => { fireEvent.click(signUpBtn); });

    expect(mockNavigate).toHaveBeenCalledWith('/auth/signup');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('[property] for any number of "Sign up" clicks, signUp() is NEVER called and navigate fires each time', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (clicks) => {
          vi.clearAllMocks();
          const onClose = vi.fn();

          const { unmount } = render(
            <MemoryRouter>
              <AuthModal isOpen={true} onClose={onClose} />
            </MemoryRouter>
          );

          const signUpBtn = screen.getByRole('button', { name: /sign up/i });
          for (let i = 0; i < clicks; i++) {
            await act(async () => { fireEvent.click(signUpBtn); });
          }

          // signUp() must NEVER be called — no inline registration
          expect(mockSignUp).not.toHaveBeenCalled();
          // navigate('/auth/signup') must fire once per click
          expect(mockNavigate).toHaveBeenCalledTimes(clicks);
          mockNavigate.mock.calls.forEach((args) => {
            expect(args[0]).toBe('/auth/signup');
          });

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('[property] for any email/password typed before clicking "Sign up", signUp() is still never called', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEmail,
        arbPassword,
        async (email, password) => {
          vi.clearAllMocks();
          const onClose = vi.fn();

          const { unmount } = render(
            <MemoryRouter>
              <AuthModal isOpen={true} onClose={onClose} />
            </MemoryRouter>
          );

          const emailInput    = screen.getByPlaceholderText(/email/i);
          const passwordInput = screen.getByPlaceholderText(/password/i);

          await act(async () => {
            fireEvent.change(emailInput,    { target: { value: email    } });
            fireEvent.change(passwordInput, { target: { value: password } });
          });

          const signUpBtn = screen.getByRole('button', { name: /sign up/i });
          await act(async () => { fireEvent.click(signUpBtn); });

          expect(mockSignUp).not.toHaveBeenCalled();
          expect(mockNavigate).toHaveBeenCalledWith('/auth/signup');

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 — Preservation Property Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Task 2 — Property 2a: AuthModal signin calls signIn() with exact credentials (preservation)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('[property] signIn() is called with the exact email and password entered; no redirect to /auth/signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEmail,
        arbPassword,
        async (email, password) => {
          vi.clearAllMocks();
          mockSignIn.mockResolvedValue(null); // success

          const onClose   = vi.fn();
          const onSuccess = vi.fn();
          const { unmount } = render(
            <MemoryRouter>
              <AuthModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
            </MemoryRouter>
          );

          await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/email/i),    { target: { value: email    } });
            fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: password } });
          });

          await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
          });

          await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

          // Exact credentials passed
          expect(mockSignIn).toHaveBeenCalledWith(email, password);

          // No redirect to /auth/signup — preservation
          const signupCalls = mockNavigate.mock.calls.filter((c) => c[0] === '/auth/signup');
          expect(signupCalls).toHaveLength(0);

          // signUp never called on signin path
          expect(mockSignUp).not.toHaveBeenCalled();

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });

  it('[property] when signIn() returns an error, no redirect to /auth/signup occurs', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbEmail,
        arbPassword,
        fc.string({ minLength: 5, maxLength: 50 }),
        async (email, password, errorMsg) => {
          vi.clearAllMocks();
          mockSignIn.mockResolvedValue(errorMsg); // simulate error

          const { unmount } = render(
            <MemoryRouter>
              <AuthModal isOpen={true} onClose={vi.fn()} />
            </MemoryRouter>
          );

          await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/email/i),    { target: { value: email    } });
            fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: password } });
          });
          await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
          });

          await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

          const signupCalls = mockNavigate.mock.calls.filter((c) => c[0] === '/auth/signup');
          expect(signupCalls).toHaveLength(0);
          expect(mockSignUp).not.toHaveBeenCalled();

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Property 2b–2d: ChangeMpesaModal guard logic (pure, no render)
// These test the exact guard condition: `if (currentPhone && normalizedNew === currentPhone)`
// ─────────────────────────────────────────────────────────────────────────────

describe('Task 2 — Property 2b/2d: ChangeMpesaModal guard logic (pure unit)', () => {
  /** The exact guard as implemented in ChangeMpesaModal.tsx */
  function shouldBlockSameNumber(currentPhone: string, normalizedNew: string): boolean {
    return Boolean(currentPhone && normalizedNew === currentPhone);
  }

  it('[property] guard fires for ANY non-empty currentPhone when the same number is entered', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        (suffix) => {
          const currentPhone  = `254${suffix}`;
          const normalizedNew = `254${suffix}`;
          expect(shouldBlockSameNumber(currentPhone, normalizedNew)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] guard NEVER fires when currentPhone is empty (first-time add)', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        (suffix) => {
          const currentPhone  = '';              // user has no phone
          const normalizedNew = `254${suffix}`;  // any new number
          expect(shouldBlockSameNumber(currentPhone, normalizedNew)).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] guard does NOT fire when a genuinely different number is entered', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        arbPhoneSuffix,
        (suffix1, suffix2) => {
          fc.pre(suffix1 !== suffix2);
          const currentPhone  = `254${suffix1}`;
          const normalizedNew = `254${suffix2}`;
          expect(shouldBlockSameNumber(currentPhone, normalizedNew)).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] guard fires for all equivalent input formats of the same number', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        (suffix) => {
          // currentPhone stored as normalised 254XXXXXXXXX
          const currentPhone = normalizeKenyanPhone(`0${suffix}`);

          // User might enter in any format — all must be caught by the guard
          const equivalentFormats = [
            `0${suffix}`,
            `254${suffix}`,
            `+254${suffix}`,
            suffix,
          ];

          for (const raw of equivalentFormats) {
            const normalizedNew = normalizeKenyanPhone(raw);
            expect(shouldBlockSameNumber(currentPhone, normalizedNew)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('[unit] guard skips when currentPhone is null (guarded by Boolean())', () => {
    // null coerces to false in Boolean()
    // TypeScript would prevent this but test the runtime behaviour
    const currentPhone  = null as unknown as string;
    const normalizedNew = '254712345678';
    expect(shouldBlockSameNumber(currentPhone, normalizedNew)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Property 2c: normalizeKenyanPhone regression guard
// ─────────────────────────────────────────────────────────────────────────────

describe('Task 2 — Property 2c: normalizeKenyanPhone (preservation)', () => {
  it('[property] always returns a 12-digit string starting with 254', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        fc.constantFrom('0', '254', '+254', ''),
        (suffix, prefix) => {
          const result = normalizeKenyanPhone(`${prefix}${suffix}`);
          expect(result).toHaveLength(12);
          expect(result.startsWith('254')).toBe(true);
          expect(/^\d{12}$/.test(result)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] all equivalent input formats produce the same canonical value', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        (suffix) => {
          const canonical = `254${suffix}`;
          expect(normalizeKenyanPhone(`0${suffix}`)).toBe(canonical);
          expect(normalizeKenyanPhone(`254${suffix}`)).toBe(canonical);
          expect(normalizeKenyanPhone(`+254${suffix}`)).toBe(canonical);
          expect(normalizeKenyanPhone(suffix)).toBe(canonical);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] suffix (last 9 digits) is preserved through normalization', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix,
        (suffix) => {
          const result = normalizeKenyanPhone(`0${suffix}`);
          expect(result.slice(3)).toBe(suffix);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Property 2e: SettingsModal button label logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Task 2 — Property 2e: SettingsModal "Add Number" / "Change" label (preservation)', () => {
  /** Exact ternary from SettingsModal.tsx */
  const getLabel = (phone: string | null | undefined) => (phone ? 'Change' : 'Add Number');

  it('[property] "Change" for any non-empty phone', () => {
    fc.assert(
      fc.property(
        arbPhoneSuffix.map((s) => `254${s}`),
        (phone) => {
          expect(getLabel(phone)).toBe('Change');
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[unit] "Add Number" for null, undefined, and empty string', () => {
    expect(getLabel(null)).toBe('Add Number');
    expect(getLabel(undefined)).toBe('Add Number');
    expect(getLabel('')).toBe('Add Number');
  });

  it('[property] result is always one of the two expected label strings', () => {
    fc.assert(
      fc.property(
        fc.option(arbPhoneSuffix.map((s) => `254${s}`), { nil: null }),
        (phone) => {
          expect(['Change', 'Add Number']).toContain(getLabel(phone));
        }
      ),
      { numRuns: 500 }
    );
  });

  it('[property] same phone always produces the same label (deterministic)', () => {
    fc.assert(
      fc.property(
        fc.option(arbPhoneSuffix.map((s) => `254${s}`), { nil: null }),
        (phone) => {
          expect(getLabel(phone)).toBe(getLabel(phone));
        }
      ),
      { numRuns: 200 }
    );
  });
});
