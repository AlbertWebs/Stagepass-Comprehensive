import { useEffect, useState } from 'react';

const STORAGE_KEY = 'stagepass-pwa-install';

function isRunningAsInstalled(): boolean {
  if (typeof window === 'undefined') return true;
  // Standalone (e.g. installed PWA or "Add to Home Screen")
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as { standalone?: boolean }).standalone === true) return true;
  // Some browsers use this when launched from home screen
  if (document.referrer.includes('android-app://')) return true;
  return false;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalled()) return;
    if (localStorage.getItem(STORAGE_KEY) === 'dismissed') return;
    if (localStorage.getItem(STORAGE_KEY) === 'installed') return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') localStorage.setItem(STORAGE_KEY, 'installed');
      setVisible(false);
      setDeferredPrompt(null);
    } catch {
      // User dismissed or prompt failed
    } finally {
      setInstalling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed');
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 shadow-lg sm:px-6"
      style={{
        background: 'linear-gradient(135deg, #172455 0%, #1e2d5c 100%)',
        color: '#fff',
      }}
    >
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <p className="font-semibold">Install Stagepass Admin</p>
          <p className="text-sm opacity-90">Add to your home screen for quick access</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg px-3 py-2 text-sm font-medium opacity-90 transition hover:opacity-100"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
          style={{ backgroundColor: '#ca8a04', color: '#fff' }}
        >
          {installing ? 'Installing…' : 'Install'}
        </button>
      </div>
    </div>
  );
}
