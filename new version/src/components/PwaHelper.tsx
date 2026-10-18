import { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };

export default function PwaHelper() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent); };
    const onInstalled = () => setInstallEvent(null);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };
  if (!offline && (!installEvent || dismissed)) return null;
  return <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95" role="status">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">{offline ? <WifiOff className="h-5 w-5" /> : <Download className="h-5 w-5" />}</span>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900 dark:text-white">{offline ? 'You are offline' : 'Install UniLink'}</p><p className="text-xs text-slate-500 dark:text-slate-400">{offline ? 'Some pages may be unavailable until your connection returns. Private data is not stored offline.' : 'Add UniLink to your home screen for quicker access.'}</p></div>
    {!offline && installEvent && <button onClick={install} className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">Install</button>}
    {!offline && <button aria-label="Dismiss install prompt" onClick={() => setDismissed(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>}
  </div>;
}
