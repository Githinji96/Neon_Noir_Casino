/**
 * Property 2: Preservation — Non-Signup-Modal Paths Are Unchanged
 *
 * These tests verify that the fix to AuthModal (redirect signup to SignUpPage)
 * does NOT regress the signin flow. For any valid (email, password) pair
 * submitted to AuthModal in signin mode, signIn() is always called with
 * those exact args and no redirect to /auth/signup occurs.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockSignIn, mockNavigate } = vi.hoisted(() => {
  const mockSignIn = vi.fn();
  const mockNavigate = vi.fn();
  return { mockSignIn, mockNavigate };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    signIn: mockSignIn,
  })),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

// ─── Import component after mocks ─────────────────────────────────────────

import AuthModal from '../AuthModal';

// ─── Generators ────────────────────────────────────────────────────────────

/** Valid email generator */
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{3,8}$/),
    fc.stringMatching(/^[a-z]{2,6}$/),
    fc.constantFrom('com', 'net', 'org', 'io', 'co.ke'),
  )
  .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

/** Valid password generator (min 8 chars) */
const passwordArb = fc
  .string({ minLength: 8, maxLength: 32 })
  .filter((s) => s.trim().length >= 8);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Property 2 – Preservation: AuthModal signin is unchanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2a: For all valid (email, password) pairs submitted to AuthModal
   * in signin mode, signIn() is always called with those exact args.
   */
  it('signIn() is called with the submitted email and password for any valid credentials', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        passwordArb,
        async (email, password) => {
          vi.clearAllMocks();
          // signIn returns null on success (no error)
          mockSignIn.mockResolvedValue(null);

          const onClose = vi.fn();
          const { unmount } = render(
            React.createElement(AuthModal, { isOpen: true, onClose }),
          );

          const emailInput = screen.getByPlaceholderText('Email');
          const passwordInput = screen.getByPlaceholderText('Password');

          fireEvent.change(emailInput, { target: { value: email } });
          fireEvent.change(passwordInput, { target: { value: password } });
          fireEvent.submit(emailInput.closest('form')!);

          await waitFor(() => {
            expect(mockSignIn).toHaveBeenCalledTimes(1);
          });

          // signIn called with correct email and password
          expect(mockSignIn).toHaveBeenCalledWith(email, password);

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Property 2b: On successful signin, onClose() is called and navigate()
   * is NOT called with '/auth/signup' — no redirect happens.
   */
  it('onClose() is called on success and navigate to /auth/signup is NEVER triggered from signin', async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        passwordArb,
        async (email, password) => {
          vi.clearAllMocks();
          mockSignIn.mockResolvedValue(null); // success

          const onClose = vi.fn();
          const { unmount } = render(
            React.createElement(AuthModal, { isOpen: true, onClose }),
          );

          const emailInput = screen.getByPlaceholderText('Email');
          const passwordInput = screen.getByPlaceholderText('Password');

          fireEvent.change(emailInput, { target: { value: email } });
          fireEvent.change(passwordInput, { target: { value: password } });
          fireEvent.submit(emailInput.closest('form')!);

          await waitFor(() => {
            expect(onClose).toHaveBeenCalledTimes(1);
          });

          // navigate must NOT have been called with /auth/signup as a result of signin
          const signupNavigateCalls = mockNavigate.mock.calls.filter(
            (args: string[]) => args[0] === '/auth/signup',
          );
          expect(signupNavigateCalls).toHaveLength(0);

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });
});
