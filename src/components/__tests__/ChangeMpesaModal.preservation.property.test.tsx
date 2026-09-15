/**
 * Property 2: Preservation — ChangeMpesaModal same-number guard is unchanged
 *
 * For all non-null currentPhone values, ChangeMpesaModal raises
 * "must be different from the current one" when the same normalised
 * number is re-entered.
 *
 * Also verifies that first-time phone addition (currentPhone = '') is no
 * longer blocked by the guard (new behaviour added in 3.3), confirming
 * the guard fix does not break the existing-phone guard.
 *
 * Validates: Requirements 3.1, 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockUseAuthStore } = vi.hoisted(() => {
  const mockUseAuthStore = vi.fn();
  return { mockUseAuthStore };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

// ─── Import component after mocks ─────────────────────────────────────────

import ChangeMpesaModal from '../ChangeMpesaModal';

// ─── Generators ────────────────────────────────────────────────────────────

/**
 * Generates valid 9-digit Kenyan local numbers (7XX or 1XX) used as
 * input in the modal's phone fields (digits only, without +254 prefix).
 */
const kenyanLocalDigitsArb = fc
  .tuple(
    fc.constantFrom('7', '1'),       // network prefix
    fc.stringMatching(/^\d{8}$/),    // 8 remaining digits
  )
  .map(([prefix, rest]) => prefix + rest);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Property 2 – Preservation: ChangeMpesaModal same-number guard is unchanged for existing phones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2c: For all non-null profile.phone values, entering the same
   * normalised number triggers "must be different from the current one" error.
   */
  it('shows "must be different" error when re-entering the same number that is already set', async () => {
    await fc.assert(
      fc.asyncProperty(
        kenyanLocalDigitsArb,
        async (localDigits) => {
          vi.clearAllMocks();

          const currentPhoneNormalized = '254' + localDigits;

          // Profile has an existing phone number
          mockUseAuthStore.mockReturnValue({
            user: { id: 'user-1', email: 'user@test.com' },
            profile: { phone: currentPhoneNormalized },
          });

          // Also stub setState since ChangeMpesaModal uses it on success
          (mockUseAuthStore as unknown as { setState: ReturnType<typeof vi.fn> }).setState = vi.fn();

          const onClose = vi.fn();
          const onSuccess = vi.fn();

          const { unmount } = render(
            React.createElement(ChangeMpesaModal, {
              isOpen: true,
              onClose,
              onSuccess,
            }),
          );

          // Fill in the same number (local digits only, the modal prepends +254)
          const newPhoneInput = screen.getAllByPlaceholderText('712 345 678')[0];
          const confirmPhoneInput = screen.getAllByPlaceholderText('712 345 678')[1];
          const passwordInput = screen.getByPlaceholderText('Enter your password to confirm');

          fireEvent.change(newPhoneInput, { target: { value: localDigits } });
          fireEvent.change(confirmPhoneInput, { target: { value: localDigits } });
          fireEvent.change(passwordInput, { target: { value: 'SomeP@ss1' } });

          // Submit the form
          const submitBtn = screen.getByText('UPDATE NUMBER');
          fireEvent.click(submitBtn);

          // Wait for error message to appear
          await waitFor(() => {
            const alert = screen.queryByRole('alert');
            expect(alert).not.toBeNull();
            expect(alert!.textContent).toContain('must be different from the current one');
          });

          unmount();
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Property 2d: When currentPhone is empty (first-time add), the guard
   * does NOT fire and the form proceeds past client-side validation.
   * (Confirms the guard fix in 3.3 only skips the guard for empty phones.)
   */
  it('does NOT show "must be different" error when adding a phone for the first time (currentPhone is empty)', async () => {
    await fc.assert(
      fc.asyncProperty(
        kenyanLocalDigitsArb,
        async (localDigits) => {
          vi.clearAllMocks();

          // Profile has NO phone (first-time add scenario)
          mockUseAuthStore.mockReturnValue({
            user: { id: 'user-1', email: 'user@test.com' },
            profile: { phone: null },
          });
          (mockUseAuthStore as unknown as { setState: ReturnType<typeof vi.fn> }).setState = vi.fn();

          const onClose = vi.fn();
          const onSuccess = vi.fn();

          const { unmount } = render(
            React.createElement(ChangeMpesaModal, {
              isOpen: true,
              onClose,
              onSuccess,
            }),
          );

          const newPhoneInput = screen.getAllByPlaceholderText('712 345 678')[0];
          const confirmPhoneInput = screen.getAllByPlaceholderText('712 345 678')[1];
          const passwordInput = screen.getByPlaceholderText('Enter your password to confirm');

          fireEvent.change(newPhoneInput, { target: { value: localDigits } });
          fireEvent.change(confirmPhoneInput, { target: { value: localDigits } });
          fireEvent.change(passwordInput, { target: { value: 'SomeP@ss1' } });

          const submitBtn = screen.getByText('UPDATE NUMBER');
          fireEvent.click(submitBtn);

          // The "must be different" error must NOT appear
          // (form may call supabase, but the guard error itself must be absent)
          await new Promise((r) => setTimeout(r, 100));

          const alert = screen.queryByRole('alert');
          if (alert) {
            expect(alert.textContent).not.toContain('must be different from the current one');
          }

          unmount();
        },
      ),
      { numRuns: 15 },
    );
  });
});
