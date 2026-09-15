/**
 * notificationStore — manages player notifications with Supabase Realtime.
 *
 * Subscriptions:
 *  - INSERT on notifications WHERE user_id = auth.uid() → prepend + increment unread
 *
 * API: standard Supabase CRUD via RLS (user can only touch their own rows).
 */
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type NotificationType =
  | 'WIN' | 'JACKPOT' | 'DEPOSIT' | 'WITHDRAWAL'
  | 'VIP' | 'PROMOTION' | 'SECURITY' | 'SYSTEM';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  target_url: string | null;
  metadata: Record<string, unknown> | null;
}

// Icons per type — Neon Noir compatible
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  WIN:        '🏆',
  JACKPOT:    '💰',
  DEPOSIT:    '💳',
  WITHDRAWAL: '💸',
  VIP:        '👑',
  PROMOTION:  '🎁',
  SECURITY:   '🔒',
  SYSTEM:     '⚙️',
};

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  hasNewNotification: boolean; // triggers bell pulse animation

  load: (userId: string) => Promise<void>;
  subscribe: (userId: string) => () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNewFlag: () => void;

  // Utility: create a local notification (for client-side events like jackpot win)
  addLocal: (notification: Omit<Notification, 'id' | 'user_id' | 'created_at' | 'read_at'> & { user_id: string }) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  hasNewNotification: false,

  load: async (userId) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifications = (data ?? []) as Notification[];
      const unreadCount = notifications.filter((n) => !n.is_read).length;
      set({ notifications, unreadCount });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[notificationStore] load error:', err);
    } finally {
      set({ loading: false });
    }
  },

  subscribe: (userId) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          set((s) => ({
            notifications: [newNotif, ...s.notifications],
            unreadCount: s.unreadCount + 1,
            hasNewNotification: true,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          set((s) => ({
            notifications: s.notifications.map((n) =>
              n.id === updated.id ? updated : n
            ),
            unreadCount: s.notifications.filter((n) =>
              n.id === updated.id ? !updated.is_read : !n.is_read
            ).length,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  markRead: async (id) => {
    const { notifications } = get();
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.is_read) return;

    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));

    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
  },

  markAllRead: async (userId) => {
    const now = new Date().toISOString();
    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true, read_at: now })),
      unreadCount: 0,
    }));

    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('user_id', userId)
      .eq('is_read', false);
  },

  deleteNotification: async (id) => {
    set((s) => {
      const removed = s.notifications.find((n) => n.id === id);
      return {
        notifications: s.notifications.filter((n) => n.id !== id),
        unreadCount: removed && !removed.is_read
          ? Math.max(0, s.unreadCount - 1)
          : s.unreadCount,
      };
    });

    await supabase.from('notifications').delete().eq('id', id);
  },

  clearNewFlag: () => set({ hasNewNotification: false }),

  addLocal: (notif) => {
    const full: Notification = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      read_at: null,
      ...notif,
    };
    set((s) => ({
      notifications: [full, ...s.notifications],
      unreadCount: notif.is_read ? s.unreadCount : s.unreadCount + 1,
      hasNewNotification: !notif.is_read,
    }));
  },
}));
