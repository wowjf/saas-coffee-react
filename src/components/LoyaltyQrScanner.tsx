import React, { useEffect, useId, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { cn } from '../lib/utils';
import { t } from "../shared/system-texts";

type LoyaltyQrScannerProps = {
  active: boolean;
  onDetected: (decodedText: string) => void | Promise<void>;
  onError: (message: string) => void;
  className?: string;
};

// MP-1.6: html5-qrcode (~1,2 MB) artik statik import degil, dinamik import ile
// yukleniyor — paket musterinin ilk yuk chunk'ina girmiyor, yalnizca tarayici
// acildiginda agdan cekiliyor.
const loadHtml5Qrcode = async () => {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
  return { Html5Qrcode, Html5QrcodeSupportedFormats };
};

function getScannerErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes('permission')) {
      return 'Kamera izni verilmedi. Tarayicidan kamera erisimine izin verin.';
    }

    if (error.message.toLowerCase().includes('secure')) {
      return 'QR tarama icin HTTPS gerekir. Alan adini https:// ile acin.';
    }

    return error.message;
  }

  return 'Kamera baslatilamadi. HTTPS veya localhost uzerinden tekrar deneyin.';
}

function pickPreferredCameraId(
  cameras: Array<{ id: string; label: string }>,
) {
  const preferredCamera = cameras.find((camera) =>
    /back|rear|environment|arka/i.test(camera.label),
  );

  return preferredCamera?.id || cameras[0]?.id || '';
}

async function stopScannerInstance(scanner: Html5Qrcode | null) {
  if (!scanner) {
    return;
  }

  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    // Scanner kapanirken olusan gecici hatalari yutuyoruz.
  }

  try {
    scanner.clear();
  } catch {
    // DOM temizligi basarisiz olsa da modal kapanisi devam etmeli.
  }
}

export const LoyaltyQrScanner: React.FC<LoyaltyQrScannerProps> = ({
  active,
  onDetected,
  onError,
  className,
}) => {
  const rawId = useId();
  const scannerId = rawId.replace(/:/g, '_');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const resolvedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onErrorRef.current = onError;
  }, [onDetected, onError]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      onErrorRef.current('Tarayici kamerasi icin HTTPS veya localhost gerekir.');
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onErrorRef.current('Bu cihaz kamera erisimini desteklemiyor.');
      return undefined;
    }

    let cancelled = false;
    resolvedRef.current = false;

    const startScannerWithCamera = async (
      scannerInstance: Html5Qrcode,
      cameraConfig: string | MediaTrackConstraints,
    ) => {
      await scannerInstance.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          if (cancelled || resolvedRef.current) {
            return;
          }

          resolvedRef.current = true;
          await stopScannerInstance(scannerInstance);
          scannerRef.current = null;
          await onDetectedRef.current(decodedText.trim());
        },
        () => {
          // Surekli basarisiz okuma denemelerinde kullaniciyi spamlemiyoruz.
        },
      );
    };

    const startScanner = async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await loadHtml5Qrcode();

        if (cancelled) {
          return;
        }

        const scanner = new Html5Qrcode(scannerId, {
          verbose: false,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();

        if (cancelled) {
          await stopScannerInstance(scanner);
          scannerRef.current = null;
          return;
        }

        const preferredCameraId = pickPreferredCameraId(cameras);

        if (preferredCameraId) {
          await startScannerWithCamera(scanner, preferredCameraId);
          return;
        }

        await startScannerWithCamera(scanner, { facingMode: { ideal: 'environment' } });
      } catch (error) {
        // Kamera baslatma hatasi: scannerRef hala kurulmus olabilir; fallback
        // denemeden once temizle.
        const scanner = scannerRef.current;

        try {
          if (scanner) {
            await startScannerWithCamera(scanner, { facingMode: { ideal: 'environment' } });
            return;
          }
        } catch (fallbackError) {
          if (cancelled) {
            return;
          }

          await stopScannerInstance(scanner);
          scannerRef.current = null;
          onErrorRef.current(getScannerErrorMessage(fallbackError || error));
          return;
        }

        if (!cancelled) {
          onErrorRef.current(getScannerErrorMessage(error));
        }
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      const activeScanner = scannerRef.current;
      scannerRef.current = null;
      void stopScannerInstance(activeScanner);
    };
  }, [active, scannerId]);

  const handleSelectQrImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';

    if (!selectedFile || resolvedRef.current) {
      return;
    }

    let scanner = scannerRef.current;

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await loadHtml5Qrcode();

      if (scanner?.isScanning) {
        await stopScannerInstance(scanner);
      }

      scanner = new Html5Qrcode(scannerId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });
      scannerRef.current = scanner;

      const decodedText = await scanner.scanFile(selectedFile, false);
      resolvedRef.current = true;
      await stopScannerInstance(scanner);
      scannerRef.current = null;
      await onDetectedRef.current(decodedText.trim());
    } catch {
      if (scanner) {
        await stopScannerInstance(scanner);
        scannerRef.current = null;
      }

      onErrorRef.current('Secilen gorselde okunabilir bir QR kod bulunamadi.');
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        id={scannerId}
        className="min-h-[280px] overflow-hidden rounded-[32px] border border-border bg-surface"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={handleSelectQrImage}
        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold"
      >
        {t("qr-gorseli-sec")}
      </button>
    </div>
  );
};
