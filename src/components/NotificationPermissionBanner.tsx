import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, Smartphone } from 'lucide-react';
import { subscribeToPush, getNotificationPermission, sendTestNotification, isPushSupported } from '../lib/pushClient';

export const NotificationPermissionBanner: React.FC = () => {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    // Check if running on iOS Safari outside standalone mode
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsIosBrowser(isIos && !isStandalone);

    const permission = getNotificationPermission();
    const isDismissed = sessionStorage.getItem('dismissed_notification_prompt') === 'true';

    if (permission === 'default' && !isDismissed) {
      // Short delay before showing so it doesn't jarringly pop on initial render
      const timer = setTimeout(() => {
        setShow(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);
    try {
      const res = await subscribeToPush();
      if (res.success) {
        setSuccess(true);
        await sendTestNotification();
        setTimeout(() => {
          setShow(false);
        }, 2500);
      } else {
        setShow(false);
      }
    } catch (e) {
      console.error(e);
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('dismissed_notification_prompt', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[90] pointer-events-auto"
      >
        <div className="bg-white rounded-3xl p-4 md:p-5 shadow-2xl border border-neutral-200/90 text-black relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>

          {success ? (
            <div className="flex items-center gap-3 py-1 text-emerald-600">
              <CheckCircle2 size={22} className="shrink-0" />
              <div>
                <p className="text-xs font-bold text-black">Bildirimler Başarıyla Açıldı!</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">Test bildirimi cihazınıza gönderildi.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 pr-6">
                <div className="w-9 h-9 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Bell size={18} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold tracking-tight text-black">Sipariş Bildirimlerini Aç</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Siparişiniz hazır olduğunda ekranınız kapalı veya kilitli olsa bile sesli bildirim alın.
                  </p>
                </div>
              </div>

              {isIosBrowser && (
                <div className="bg-neutral-50 border border-neutral-200/70 rounded-2xl p-2.5 flex items-center gap-2 text-[10px] text-neutral-600">
                  <Smartphone size={14} className="shrink-0 text-black" />
                  <span>iPhone'da kilit ekranı için: Paylaş ⎋ &gt; <b>Ana Ekrana Ekle</b> yapınız.</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 text-xs font-bold hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  Şimdi Değil
                </button>
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {loading ? 'İzin İsteniyor...' : 'Bildirimleri Aç'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
