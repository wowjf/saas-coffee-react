import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const VAPID_KEYS_FILE = path.resolve(process.cwd(), '.vapid-keys.json');

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export function getVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

  if (fs.existsSync(VAPID_KEYS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf-8'));
      if (data.publicKey && data.privateKey) {
        return data;
      }
    } catch {
      // ignore, regenerate below
    }
  }

  const keys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save .vapid-keys.json:', err);
  }
  return keys;
}

export function configureWebPush(): VapidKeys {
  const keys = getVapidKeys();
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@banchocafe.com';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  return keys;
}
