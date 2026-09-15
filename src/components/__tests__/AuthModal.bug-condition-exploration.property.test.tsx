/**
 * Bug Condition Exploration Test — Task 1 (re-run on fixed code in Task 3.4)
 *
 * Property 1: Bug Condition → Expected Behavior
 * AuthModal Signup Redirects to SignUpPage
 *
 * On UNFIXED code this test FAILS (confirming the bug: signUp() was called inline).
 * On FIXED code this test PASSES (confirming the fix: navigate('/auth/signup') is called,
 * signUp() is NOT called).
 *
 * Validates: Requirements 1.1, 1.2 (bug condition), 2.1, 2.3 (expected behavior)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSignIn, mockSignUp, mockNavigate } = vi.hoisted(() => {
  const mockSignIn = vi.fn().mockResolvedValue(null);
  const mockSignUp = vi.fn().mockResolvedValue(null);
  const mockNavigate = vi.fn();
  return { mockSignIn, mockSignUp, mockNavigate };
});

// Mock react-router-dom so navigate is interceptable
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock authStore so signIn/signUp are interceptable
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { signIn: mockSignIn, signUp: mockSignUp };
    return selector ? selector(state) : state;
  },
}));

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Import component after mocks
import AuthModal from '../AuthModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(onClose = vi.fn()) {
  return render(<AuthModal isOpen={true} onClose={onClose} />);
}

// ─── Bug Condition Exploration Property ──────────────────────────────────────

/**
 * Validates: Requirements 2.1, 2.3
 *
 * Property 1: For any interaction with AuthModal where the user initiates
 * signup (clicks the "Sign up" link/button), the fixed AuthModal SHALL call
 * navigate('/auth/signup') and SHALL NOT call signUp() inline.
 *
 * This is the bug condition exploration test. On unfixed code it FAILS because
 * signUp() is called. On fixed code it PASSES because the redirect happens.
 */
describe('Property 1 – Bug Condition Exploration: AuthModal Signup Redirects to SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('clicking "Sign up" always calls navigate("/auth/signup") and never calls signUp()', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          vi.clearAllMocks();
          cleanup();
          const onClose = vi.fn();

          const { container } = renderModal(onClose);

          // Find the "Sign up" link/button scoped to this container
          const signUpButton = within(container).getByRole('button', { name: /sign up/i });
          expect(signUpButton).toBeTruthy();

          // Click it — on fixed code this triggers navigate('/auth/signup') + onClose()
          fireEvent.click(signUpButton);

          // Property: navigate('/auth/signup') MUST have been called
          expect(mockNavigate).toHaveBeenCalledWith('/auth/signup');

          // Property: signUp() MUST NOT have been called (no inline registration)
          expect(mockSignUp).not.toHaveBeenCalled();

          // Property: onClose() MUST have been called (modal closes on redirect)
          expect(onClose).toHaveBeenCalled();

          cleanup();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('submitting the signin form does NOT call navigate("/auth/signup")', async () => {
    // Preservation: signin via AuthModal should still call signIn, not navigate
    vi.clearAllMocks();
    const onClose = vi.fn();
    const { container } = renderModal(onClose);

    const emailInput = within(container).getByPlaceholderText(/email/i);
    const passwordInput = within(container).getByPlaceholderText(/password/i);
    const submitButton = within(container).getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    // signUp() was never called during signin
    expect(mockSignUp).not.toHaveBeenCalled();
    // navigate('/auth/signup') was NOT triggered by signin
    expect(mockNavigate).not.toHaveBeenCalledWith('/auth/signup');
  });

  it('property-based: for any email/password pair, signin never triggers redirect to /auth/signup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 8, maxLength: 50 }),
        async (email, password) => {
          vi.clearAllMocks();
          cleanup();
          const onClose = vi.fn();

          const { container } = renderModal(onClose);

          const emailInput = within(container).getByPlaceholderText(/email/i);
          const passwordInput = within(container).getByPlaceholderText(/password/i);
          const submitButton = within(container).getByRole('button', { name: /sign in/i });

          fireEvent.change(emailInput, { target: { value: email } });
          fireEvent.change(passwordInput, { target: { value: password } });
          fireEvent.click(submitButton);

          // signUp() is never called in signin path
          expect(mockSignUp).not.toHaveBeenCalled();
          // navigate('/auth/signup') is never called in signin path
          expect(mockNavigate).not.toHaveBeenCalledWith('/auth/signup');

          cleanup();
        }
      ),
      { numRuns: 20 }
    );
  });
});
