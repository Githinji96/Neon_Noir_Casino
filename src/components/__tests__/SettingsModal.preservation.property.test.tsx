/**
 * Property 2: Preservation — SettingsModal phone button display
 *
 * For any non-null profile.phone value, SettingsModal renders a "Change"
 * button next to "Registered Number" (no regression from the 3.2 fix).
 * For null phone, it renders "Add Number".
 *
 * Validates: Requirements 3.1, 3.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockUseAuthStore, mockUseSettingsStore, mockUseGameStore } = vi.hoisted(() => {
  const mockUseAuthStore = vi.fn();
  const mockUseSettingsStore = vi.fn();
  const mockUseGameStore = vi.fn();
  return { mockUseAuthStore, mockUseSettingsStore, mockUseGameStore };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: mockUseAuthStore,
}));

vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: mockUseSettingsStore,
}));

vi.mock('../../store/gameStore', () => ({
  useGameStore: mockUseGameStore,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {},
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

// Mock ChangeMpesaModal to avoid its complex dependencies
vi.mock('../ChangeMpesaModal', () => ({
  default: () => null,
}));

// ─── Import component after mocks ─────────────────────────────────────────

import SettingsModal from '../SettingsModal';

// ─── Default settings stub ─────────────────────────────────────────────────

const defaultSettings = {
  theme: 'dark',
  soundEnabled: true,
  musicEnabled: true,
  animationSpeed: 'normal',
  autoSpinCount: 10,
  stopOnWin: false,
  responsibleGambling: false,
  dailyDepositLimit: 0,
  weeklyDepositLimit: 0,
  monthlyDepositLimit: 0,
  dailyLossLimit: 0,
  notifPromotions: true,
  notifJackpot: true,
  notifWins: true,
  notifSecurity: true,
  language: 'en',
};

function setupStoreMocks(phone: string | null) {
  const storeState = {
    user: { id: 'user-1', email: 'user@test.com' },
    profile: { phone, username: 'testuser' },
    signOut: vi.fn(),
    refreshBalance: vi.fn(),
  };

  mockUseAuthStore.mockImplementation((selector: (s: any) => any) =>
    selector(storeState),
  );

  // SettingsModal calls useAuthStore.getState() directly inside a useEffect
  (mockUseAuthStore as unknown as Record<string, unknown>).getState = () => storeState;

  mockUseSettingsStore.mockImplementation((selector: (s: any) => any) =>
    selector({
      isOpen: true,
      closeSettings: vi.fn(),
      settings: defaultSettings,
      updateSettings: vi.fn(),
      saveToSupabase: vi.fn(),
      loadFromSupabase: vi.fn(),
    }),
  );

  mockUseGameStore.mockImplementation((selector: (s: any) => any) =>
    selector({ balance: 1000 }),
  );
}

// ─── Generators ────────────────────────────────────────────────────────────

const kenyanPhoneArb = fc
  .tuple(
    fc.constantFrom('7', '1'),
    fc.stringMatching(/^\d{8}$/),
  )
  .map(([prefix, rest]) => '254' + prefix + rest);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Property 2 – Preservation: SettingsModal phone button display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 2e: For all non-null profile.phone values, SettingsModal
   * renders a "Change" button next to "Registered Number".
   */
  it('renders "Change" button for all non-null phone profiles', () => {
    fc.assert(
      fc.property(
        kenyanPhoneArb,
        (phone) => {
          setupStoreMocks(phone);

          const { unmount } = render(React.createElement(SettingsModal));

          const changeBtn = screen.queryByRole('button', { name: /Change/i });
          expect(changeBtn).not.toBeNull();

          unmount();
          return true;
        },
      ),
      { numRuns: 20 },
    );
  });

  /**
   * Property 2f: For null profile.phone, SettingsModal renders
   * "Add Number" button (new feature from 3.2 fix).
   */
  it('renders "Add Number" button when profile.phone is null', () => {
    setupStoreMocks(null);

    const { unmount } = render(React.createElement(SettingsModal));

    const addBtn = screen.queryByRole('button', { name: /Add Number/i });
    expect(addBtn).not.toBeNull();

    unmount();
  });
});
