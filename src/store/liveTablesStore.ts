/**
 * Live Tables Store
 * Simulates real-time table updates via polling interval.
 */
import { create } from 'zustand';
import { INITIAL_TABLES, type LiveTable, type TableStatus } from '../config/liveTablesData';

interface LiveTablesState {
  tables: LiveTable[];
  startPolling: () => () => void;
}

function simulateUpdate(tables: LiveTable[]): LiveTable[] {
  return tables.map((t) => {
    // Randomly fluctuate player count ±1
    const delta = Math.random() < 0.3 ? (Math.random() < 0.5 ? 1 : -1) : 0;
    const newCount = Math.max(0, Math.min(t.maxPlayers, t.currentPlayers + delta));
    let status: TableStatus = t.status;
    if (newCount >= t.maxPlayers) status = 'full';
    else if (newCount === 0) status = 'waiting';
    else status = 'live';
    return { ...t, currentPlayers: newCount, status };
  });
}

export const useLiveTablesStore = create<LiveTablesState>((set) => ({
  tables: INITIAL_TABLES,

  startPolling: () => {
    const interval = setInterval(() => {
      set((s) => ({ tables: simulateUpdate(s.tables) }));
    }, 4000);
    return () => clearInterval(interval);
  },
}));
