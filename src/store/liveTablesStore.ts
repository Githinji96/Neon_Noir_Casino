/**
 * Live Tables Store
 * Simulates real-time table updates via polling interval.
 */
import { create } from 'zustand';
import { INITIAL_TABLES, type LiveTable, type TableStatus } from '../config/liveTablesData';
import { supabase } from '../lib/supabase';

interface LiveTablesState {
  tables: LiveTable[];
  startPolling: () => () => void;
}

function mapDbRowToLiveTable(row: any, fallback: LiveTable): LiveTable {
  const statusMap: Record<string, TableStatus> = {
    open: 'live',
    live: 'live',
    full: 'full',
    closed: 'waiting',
    maintenance: 'waiting',
    paused: 'waiting',
    inactive: 'waiting',
  };
  return {
    id: row.id ?? fallback.id,
    gameType: (row.game_type as any) ?? fallback.gameType,
    name: row.name ?? fallback.name,
    dealerName: fallback.dealerName,
    dealerAvatar: fallback.dealerAvatar,
    currentPlayers: row.occupied ?? fallback.currentPlayers,
    maxPlayers: row.seats ?? fallback.maxPlayers,
    minBet: row.min_bet ?? fallback.minBet,
    maxBet: row.max_bet ?? fallback.maxBet,
    status: statusMap[row.status] ?? fallback.status,
    featured: fallback.featured,
  };
}

export const useLiveTablesStore = create<LiveTablesState>((set) => ({
  tables: INITIAL_TABLES,

  startPolling: () => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await supabase.from('live_tables').select('id, name, game_type, status, occupied, seats, min_bet, max_bet');
        if (cancelled) return;
        if (data && data.length) {
          // merge DB rows with INITIAL_TABLES by id to keep dealer metadata
          const merged = INITIAL_TABLES.map((t) => {
            const row = (data as any[]).find((r) => r.id === t.id);
            return row ? mapDbRowToLiveTable(row, t) : t;
          });
          set({ tables: merged });
          return;
        }
      } catch (err) {
        // Keep simulated data on error
        // eslint-disable-next-line no-console
        console.warn('[liveTablesStore] load error:', err);
      }
    }

    // Initial load
    void load();

    // Subscribe to changes
    const channel = supabase
      .channel('live_tables_client')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_tables' }, () => {
        void load();
      })
      .subscribe();

    // Fallback polling every 6 seconds
    const interval = setInterval(() => { if (!cancelled) void load(); }, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  },
}));
