import { apiRequest } from './api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(orderId?: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Tarayıcınız bildirim desteğini desteklemiyor.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Bildirim izni reddedildi.' };
    }

    const reg = await registerServiceWorker();
    if (!reg) {
      return { success: false, error: 'Servis çalıştırılamadı.' };
    }

    // Get public key from server
    const { publicKey } = await apiRequest<{ publicKey: string }>('/api/push/public-key');
    if (!publicKey) {
      return { success: false, error: 'VAPID anahtarı alınamadı.' };
    }

    // Subscribe to push
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // Send subscription to backend
    await apiRequest('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        orderId,
      }),
    });

    return { success: true };
  } catch (err: any) {
    console.error('Push subscription failed:', err);
    return { success: false, error: err.message || 'Abonelik oluşturulamadı.' };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await apiRequest('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});
      await subscription.unsubscribe();
    }
    return true;
  } catch {
    return false;
  }
}

export async function sendTestNotification(orderId?: string): Promise<boolean> {
  try {
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await apiRequest('/api/push/test', {
          method: 'POST',
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            orderId,
          }),
        });
        playChimeSound();
        return true;
      }
    }

    await apiRequest('/api/push/test', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    playChimeSound();
    return true;
  } catch (err) {
    console.error('Test notification failed:', err);
    return false;
  }
}

/**
 * Pleasant Web Audio API synthesized cafe chime for in-app alerts
 */
export function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);

      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.55);
    });
  } catch (e) {
    // Audio context not allowed before user interaction
  }
}
