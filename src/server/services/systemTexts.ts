import { SYSTEM_TEXTS } from "../../shared/system-texts.js";
import SystemTextModel from "../models/SystemText";

let cache: Record<string, string> | null = null;
let cachePromise: Promise<Record<string, string>> | null = null;

export async function loadSystemTextOverrides(force = false) {
  if (cache && !force) {
    return cache;
  }

  if (cachePromise && !force) {
    return cachePromise;
  }

  cachePromise = (async () => {
    const docs = await SystemTextModel.find({}).select({ key: 1, value: 1 }).lean();
    cache = Object.fromEntries(docs.map((doc) => [doc.key, doc.value]));
    return cache;
  })().finally(() => {
    cachePromise = null;
  });

  return cachePromise;
}

export async function invalidateSystemTextCache() {
  cache = null;
  await loadSystemTextOverrides();
}

export async function getSystemText(key: string) {
  const overrides = await loadSystemTextOverrides();
  return overrides[key] ?? SYSTEM_TEXTS[key] ?? key;
}

export async function listSystemTextOverrides() {
  const overrides = await loadSystemTextOverrides();
  return Object.entries(overrides).map(([key, value]) => ({ key, value }));
}