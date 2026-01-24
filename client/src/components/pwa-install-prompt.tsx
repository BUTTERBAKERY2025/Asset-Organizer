import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                               (window.navigator as any).standalone === true;
    
    setIsIOS(isIOSDevice);

    if (isInStandaloneMode) {
      return;
    }

    const dismissedTime = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedTime) {
      const hoursSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        return;
      }
    }

    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.removeItem('pwa-prompt-dismissed');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) {
    return null;
  }

  if (!isIOS && !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shrink-0 animate-pulse">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-800 text-sm">
                  تثبيت التطبيق
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Install App on Your Device
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                data-testid="button-dismiss-pwa"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              {isIOS 
                ? 'للتثبيت على iPhone أو iPad، اتبع الخطوات أدناه'
                : 'قم بتثبيت التطبيق على جهازك للوصول السريع والعمل بدون إنترنت'
              }
            </p>

            {!isIOS && deferredPrompt && (
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="flex-1 gap-2 text-xs h-9"
                  data-testid="button-install-pwa"
                >
                  <Download className="w-3.5 h-3.5" />
                  تثبيت الآن
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                  className="text-xs h-9"
                >
                  لاحقاً
                </Button>
              </div>
            )}

            {isIOS && (
              <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span>اضغط على أيقونة المشاركة</span>
                  <Share className="w-4 h-4 text-primary shrink-0" />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>اختر "إضافة إلى الشاشة الرئيسية"</span>
                </div>
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 mt-2"
                >
                  فهمت، شكراً
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
