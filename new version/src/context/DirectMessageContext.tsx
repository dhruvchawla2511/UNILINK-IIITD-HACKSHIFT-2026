// Keeps the unread count of direct messages (for the badge in the menu) and lets any screen open a conversation.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { dmApi } from '@/lib/directMessages';
import { useAuth } from '@/context/AuthContext';

interface DmContextValue {
  /** messages you have not read, across all conversations */
  unread: number;
  unreadByRoom: Record<string, number>;
  /** ask the server again (debounced); call after reading a conversation */
  refreshUnread: () => void;
  /** go to the Messages page and open (or start) the conversation with this person. Undefined outside the app shell. */
  openDirectMessage?: (userId: string) => void;
}

const DmContext = createContext<DmContextValue>({ unread: 0, unreadByRoom: {}, refreshUnread: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export const useDirectMessages = () => useContext(DmContext);

export function DirectMessageProvider({ onOpen, children }: { onOpen: (userId: string) => void; children: ReactNode }) {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<{ total: number; rooms: Record<string, number> }>({ total: 0, rooms: {} });
  const timer = useRef<number>();

  const refreshUnread = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const { data } = await dmApi.unread();
      if (data) setSummary(data);
    }, 250);
  }, []);

  const myId = profile?.id;
  useEffect(() => {
    if (!myId) return;
    refreshUnread();
    // any new, removed or read direct message: count again (the server only sends these to the two people in the conversation)
    const channel = supabase
      .channel('dm-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, () => refreshUnread())
      .subscribe();
    const wake = () => { if (document.visibilityState === 'visible') refreshUnread(); };
    document.addEventListener('visibilitychange', wake);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', wake);
      supabase.removeChannel(channel);
    };
  }, [myId, refreshUnread]);

  const value = useMemo(
    () => ({ unread: summary.total, unreadByRoom: summary.rooms, refreshUnread, openDirectMessage: onOpen }),
    [summary, refreshUnread, onOpen]
  );
  return <DmContext.Provider value={value}>{children}</DmContext.Provider>;
}
