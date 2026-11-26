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
import { render, fireEvent, cleanup, within, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSignIn, mockSignUp, mockNavigate } = vi.hoisted(() => {
  const mockSignIn = vi.fn().mockResolvedValue(null);
  const mockSignUp = vi.fn().mockResolvedValue(null);
  const mockNavigate = vi.fn();
  return { mockSignIn, mockSignUp, mockNavigate };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { signIn: mockSignIn, signUp: mockSignUp };
    return selector ? selector(state) : state;
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import AuthModal from '../AuthModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(onClose = vi.fn()) {
  return render(<AuthModal isOpen={true} onClose={onClose} />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

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

          const signUpButton = within(container).getByRole('button', { name: /sign up/i });
          expect(signUpButton).toBeTruthy();

          await act(async () => {
            fireEvent.click(signUpButton);
          });

          expect(mockNavigate).toHaveBeenCalledWith('/auth/signup');
          expect(mockSignUp).not.toHaveBeenCalled();
          expect(onClose).toHaveBeenCalled();

          cleanup();
        }
      ),
      { numRuns: 10 }
    );
  });

  it('submitting the signin form does NOT call navigate("/auth/signup")', async () => {
    vi.clearAllMocks();
    const onClose = vi.fn();
    const { container } = renderModal(onClose);

    const emailInput    = within(container).getByPlaceholderText(/email/i);
    const passwordInput = within(container).getByPlaceholderText(/password/i);
    const submitButton  = within(container).getByRole('button', { name: /sign in/i });

    await act(async () => {
      fireEvent.change(emailInput,    { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
    });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for signIn promise to settle
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

    expect(mockSignUp).not.toHaveBeenCalled();
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

          await act(async () => {
            fireEvent.change(
              within(container).getByPlaceholderText(/email/i),
              { target: { value: email } }
            );
            fireEvent.change(
              within(container).getByPlaceholderText(/password/i),
              { target: { value: password } }
            );
          });

          await act(async () => {
            fireEvent.click(within(container).getByRole('button', { name: /sign in/i }));
          });

          await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

          expect(mockSignUp).not.toHaveBeenCalled();
          expect(mockNavigate).not.toHaveBeenCalledWith('/auth/signup');

          cleanup();
        }
      ),
      { numRuns: 20 }
    );
  });
});
