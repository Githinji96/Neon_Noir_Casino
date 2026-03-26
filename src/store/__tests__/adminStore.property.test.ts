// Feature: casino-admin-panel, Property 27: For any admin action, audit log row has all required non-null fields

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ─── Hoisted mocks (vi.mock factory is hoisted to top of file) ────────────────

const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockInsert, mockFrom };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: mockFrom,
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

// ─── Import store after mock ──────────────────────────────────────────────────

import { useAdminStore, AuditActionType, AdminRole } from '../adminStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ACTION_TYPES: AuditActionType[] = [
  'balance_adjust',
  'user_suspend',
  'user_ban',
  'password_reset',
  'withdrawal_approve',
  'withdrawal_reject',
  'payment_retry',
  'game_toggle',
  'game_config_update',
  'table_create',
  'table_edit',
  'table_pause',
  'table_resume',
  'player_kick',
  'round_restart',
  'rtp_update',
  'jackpot_config_update',
  'jackpot_force_reset',
  'bet_limit_apply',
  'fraud_flag_dismiss',
];

const ALL_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'finance_admin',
  'support_agent',
  'game_manager',
];

// ─── Property 27 ─────────────────────────────────────────────────────────────

/**
 * Validates: Requirements 11.1, 11.4
 *
 * Property 27: For any admin action, the audit log entry passed to the
 * Supabase insert contains non-null values for admin_id, admin_role,
 * and action_type. The created_at field is omitted from the insert payload
 * and set server-side by the database.
 */
describe('Property 27 – auditLog() completeness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it('insert payload always contains non-null admin_id, admin_role, and action_type for any valid action type', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary action type
        fc.constantFrom(...ALL_ACTION_TYPES),
        // Generate arbitrary admin role
        fc.constantFrom(...ALL_ADMIN_ROLES),
        // Generate arbitrary admin_id (non-empty UUID-like string)
        fc.uuid(),
        // Generate arbitrary target_entity (string | null)
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
        // Generate arbitrary target_id (string | null)
        fc.option(fc.uuid(), { nil: null }),
        async (actionType, adminRole, adminId, targetEntity, targetId) => {
          vi.clearAllMocks();
          mockInsert.mockResolvedValue({ data: null, error: null });
          mockFrom.mockReturnValue({ insert: mockInsert });

          // Set up store state with a mock adminProfile
          useAdminStore.setState({
            adminProfile: {
              id: adminId,
              username: 'test_admin',
              admin_role: adminRole,
            },
          });

          const entry = {
            admin_id: adminId,
            admin_role: adminRole,
            action_type: actionType,
            target_entity: targetEntity,
            target_id: targetId,
            previous_value: null,
            new_value: null,
            ip_address: null,
          };

          await useAdminStore.getState().auditLog(entry);

          // Verify supabase.from was called with the audit logs table
          expect(mockFrom).toHaveBeenCalledWith('admin_audit_logs');

          // Verify insert was called exactly once
          expect(mockInsert).toHaveBeenCalledTimes(1);

          // Extract the payload passed to insert
          const insertedPayload = mockInsert.mock.calls[0][0] as typeof entry;

          // Property 27: required non-null fields must be present and non-null
          expect(insertedPayload.admin_id).not.toBeNull();
          expect(insertedPayload.admin_id).not.toBeUndefined();
          expect(insertedPayload.admin_id).toBe(adminId);

          expect(insertedPayload.admin_role).not.toBeNull();
          expect(insertedPayload.admin_role).not.toBeUndefined();
          expect(insertedPayload.admin_role).toBe(adminRole);

          expect(insertedPayload.action_type).not.toBeNull();
          expect(insertedPayload.action_type).not.toBeUndefined();
          expect(insertedPayload.action_type).toBe(actionType);

          // created_at is omitted from the insert payload (set by DB server-side)
          expect((insertedPayload as Record<string, unknown>).created_at).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
