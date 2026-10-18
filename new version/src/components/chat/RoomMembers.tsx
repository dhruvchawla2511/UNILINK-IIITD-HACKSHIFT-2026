import { useCallback, useEffect, useState } from 'react';
import { Crown, Loader2, LogOut, UserMinus, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import UserBadges from '@/components/UserBadges';
import { apiPost, supabase, type ChatRoom, type Profile } from '@/lib/supabase';

type Member = { id: string; user_id: string; joined_at: string; user: Profile | null };

/** Who is in a private room. The owner can remove people; everyone else can leave. */
export function RoomMembersModal({
  room,
  viewerId,
  canManage,
  onClose,
  onLeft,
}: {
  room: ChatRoom;
  viewerId: string;
  canManage: boolean; // the room's owner, or a website admin
  onClose: () => void;
  onLeft: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = room.created_by === viewerId;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('room_members')
      .select('*, user:profiles!user_id(*)')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true });
    if (data) setMembers(data as Member[]);
    setLoading(false);
  }, [room.id]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.user?.full_name ?? 'this person'} from the room? They can join again with the room code, unless you make a new code.`)) return;
    setBusy(m.user_id);
    setError(null);
    const { error } = await apiPost('/api/chat/room/remove', { room_id: room.id, user_id: m.user_id });
    setBusy(null);
    if (error) setError(error.message);
    load();
  };

  const leave = async () => {
    if (!window.confirm('Leave this room? You can only come back with the room code.')) return;
    setBusy(viewerId);
    setError(null);
    const { error } = await apiPost('/api/chat/room/leave', { room_id: room.id });
    setBusy(null);
    if (error) return setError(error.message);
    onLeft();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-lg text-slate-900 dark:text-slate-100">Members</h3>
            <p className="text-xs text-slate-400 truncate">{room.name}{members.length ? ` · ${members.length} ${members.length === 1 ? 'person' : 'people'}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 overflow-y-auto scrollbar-thin flex-1 space-y-1.5">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
          ) : (
            members.map((m) => {
              const owner = m.user_id === room.created_by;
              const me = m.user_id === viewerId;
              return (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-950">
                  <Avatar name={m.user?.full_name} url={m.user?.avatar_url} fallbackClass="bg-slate-400" />
                  <p className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {m.user?.full_name ?? 'Unknown'}{me && <span className="text-slate-400 font-normal"> (you)</span>}
                    <UserBadges userId={m.user_id} max={2} compact className="ml-1.5" />
                  </p>
                  {owner && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <Crown className="w-3 h-3" /> Owner
                    </span>
                  )}
                  {canManage && !owner && !me && (
                    <button
                      onClick={() => remove(m)}
                      disabled={busy === m.user_id}
                      title="Remove from room"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {busy === m.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 pt-3 pb-6 space-y-3">
          {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">{error}</div>}
          {canManage && (
            <p className="text-xs text-slate-400">People you remove can rejoin with the room code. To stop that, press the refresh button next to the code to make a new one.</p>
          )}
          {!isOwner && (
            <button
              onClick={leave}
              disabled={busy === viewerId}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" /> Leave room
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
