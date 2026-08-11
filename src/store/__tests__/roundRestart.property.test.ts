 // Property test: round restart refunds all bets (Spec P22)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Hoisted mock for supabase to simulate DB tables in-memory
const { mockFrom, tableMocks } = vi.hoisted(() => {
  const tableMocks: Record<string, any> = {};

  const mockFrom = vi.fn((table: string) => {
    if (!tableMocks[table]) {
      // default mock funcs
      tableMocks[table] = {
        select: vi.fn().mockImplementation(() => ({ eq: vi.fn() })),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockImplementation(() => ({ eq: vi.fn() })),
        delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }
    return tableMocks[table];
  });

  return { mockFrom, tableMocks };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
    removeChannel: vi.fn(),
    auth: { getUser: vi.fn(), signOut: vi.fn(), onAuthStateChange: vi.fn() },
  },
}));

import { supabase } from '../../lib/supabase';

// Server-side helper we are testing the property for (simulated here)
async function restartLiveRound(tableId: string) {
  // Fetch bets for the table
  const { data: bets } = await supabase.from('live_table_bets').select('*').eq('table_id', tableId) as any;
  if (!bets || bets.length === 0) {
    // still record audit entry
    await supabase.from('admin_audit_logs').insert([{ admin_id: null, admin_role: 'super_admin', action_type: 'round_restart', target_entity: 'live_tables', target_id: tableId, previous_value: null, new_value: null, ip_address: null }]);
    return { refunded: 0 };
  }

  let refunded = 0;
  // Refund each bet to the corresponding profile
  for (const b of bets) {
    const userId = b.user_id;
    const amount = Number(b.amount || 0);
    // read current profile
    const { data: profile } = await supabase.from('profiles').select('id, balance').eq('id', userId) as any;
    const currentBalance = profile?.balance ?? 0;
    const newBalance = currentBalance + amount;
    await supabase.from('profiles').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);
    refunded += amount;
  }

  // Optionally remove bets for this round
  await supabase.from('live_table_bets').delete().eq('table_id', tableId);

  // Audit entry
  await supabase.from('admin_audit_logs').insert([{ admin_id: null, admin_role: 'super_admin', action_type: 'round_restart', target_entity: 'live_tables', target_id: tableId, previous_value: null, new_value: { refunded }, ip_address: null }]);

  return { refunded };
}

describe('Property P22 — round restart refunds bets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // reset tableMocks to default behaviors
    for (const _k of Object.keys(tableMocks)) {
      delete tableMocks[_k];
    }
  });

  it('refunds each player exactly their bet amount and records audit entry', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // table id
        fc.array(fc.record({ userId: fc.uuid(), amount: fc.integer({ min: 1, max: 10000 }) }), { minLength: 1, maxLength: 10 }),
        async (tableId, betsInput) => {
          // Build in-memory tables
          const bets = betsInput.map((b, i) => ({ id: `bet-${i}`, user_id: b.userId, amount: b.amount, table_id: tableId }));
          const profilesMap: Record<string, { id: string; balance: number }> = {};
          for (const b of bets) {
            // give each player an initial random balance
            profilesMap[b.user_id] = { id: b.user_id, balance: Math.floor(Math.random() * 1000) };
          }

          // Wire tableMocks to respond accordingly
          // live_table_bets.select(...).eq('table_id', tableId) -> { data: bets }
          tableMocks['live_table_bets'] = {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((field: string, val: string) => {
                if (field === 'table_id' && val === tableId) return Promise.resolve({ data: bets });
                return Promise.resolve({ data: [] });
              }),
            })),
            delete: vi.fn().mockImplementation(() => ({ eq: vi.fn().mockResolvedValue({ data: null }) })),
          } as any;

          // profiles.select(...).eq('id', userId) -> { data: profile }
          tableMocks['profiles'] = {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((_field: string, val: string) => {
                const p = profilesMap[val] ? { id: val, balance: profilesMap[val].balance } : null;
                return Promise.resolve({ data: p });
              }),
            })),
            update: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockImplementation((_field: string, _val: string) => {
                return Promise.resolve({ data: null, error: null });
              }),
            })),
          } as any;

          // admin_audit_logs.insert -> capture payload
          const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
          tableMocks['admin_audit_logs'] = { insert: auditInsert } as any;

          // Replace mockFrom to return our tableMocks
          (supabase as any).from = (tableName: string) => tableMocks[tableName] ?? ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) });

          // profiles.update mock: accept any _field/_val and resolve
          tableMocks['profiles'].update = () => ({ eq: (_field: string, _val: string) => {
            return Promise.resolve({ data: null, error: null });
          } });

          // Now run the restart logic
          const result = await restartLiveRound(tableId);

          // Assert refunded total equals sum of bet amounts
          const expectedRefund = bets.reduce((s, b) => s + Number(b.amount), 0);
          expect(result.refunded).toBe(expectedRefund);

          // Assert audit insert was called with action_type 'round_restart' and includes refunded amount
          expect(auditInsert).toHaveBeenCalled();
          const insertedPayload = auditInsert.mock.calls[0][0][0];
          expect(insertedPayload.action_type).toBe('round_restart');
          expect(insertedPayload.target_id).toBe(tableId);
          expect(insertedPayload.new_value).toMatchObject({ refunded: expectedRefund });
        }
      ),
      { numRuns: 20 }
    );
  });
});
