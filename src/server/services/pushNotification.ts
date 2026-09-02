import webpush from 'web-push';
import PushSubscriptionModel from '../models/PushSubscription.js';
import { configureWebPush } from '../config/vapid.js';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    orderId?: string;
    type?: string;
    [key: string]: unknown;
  };
}

let isConfigured = false;

function ensureConfigured() {
  if (!isConfigured) {
    configureWebPush();
    isConfigured = true;
  }
}

export async function sendPushToSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
) {
  ensureConfigured();
  try {
    const payloadString = JSON.stringify({
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      ...payload,
    });

    await webpush.sendNotification(subscription, payloadString);
    return true;
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription has expired or is no longer valid, remove from DB
      await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint }).catch(() => {});
    } else {
      console.warn('Web push delivery failed for endpoint:', subscription.endpoint, err.message);
    }
    return false;
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!userId) return;
  const subs = await PushSubscriptionModel.find({ userId }).lean();
  await Promise.allSettled(
    subs.map(sub => sendPushToSubscription({ endpoint: sub.endpoint, keys: sub.keys }, payload)),
  );
}

export async function sendPushToOrder(orderId: string, payload: PushPayload, userId?: string) {
  const orConditions: Array<{ orderId?: string; userId?: string }> = [{ orderId }];
  if (userId) {
    orConditions.push({ userId });
  }

  const subs = await PushSubscriptionModel.find({
    $or: orConditions,
  }).lean();

  await Promise.allSettled(
    subs.map(sub => sendPushToSubscription({ endpoint: sub.endpoint, keys: sub.keys }, payload)),
  );
}

export async function sendPushToRole(roles: ('staff' | 'manager')[], payload: PushPayload) {
  const subs = await PushSubscriptionModel.find({
    role: { $in: roles },
  }).lean();

  await Promise.allSettled(
    subs.map(sub => sendPushToSubscription({ endpoint: sub.endpoint, keys: sub.keys }, payload)),
  );
}
