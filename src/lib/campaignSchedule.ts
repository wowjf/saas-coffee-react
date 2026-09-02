import { t } from "../shared/system-texts";
import type { Campaign } from "../types";

const TURKEY_UTC_OFFSET_MINUTES = 180;

function parseDateParts(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number(value));

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function parseTimeParts(time: string) {
  const [hour, minute] = time.split(":").map((value) => Number(value));

  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function getTurkeyDateTimeMs(date: string, time = "00:00", seconds = 0) {
  const dateParts = parseDateParts(date);

  if (!dateParts) {
    return null;
  }

  const timeParts = parseTimeParts(time);

  return (
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, timeParts.hour, timeParts.minute, seconds) -
    TURKEY_UTC_OFFSET_MINUTES * 60 * 1000
  );
}

export function getTurkeyDateTimeIso(date: string, time = "00:00", seconds = 0) {
  const timestamp = getTurkeyDateTimeMs(date, time, seconds);
  return timestamp === null ? null : new Date(timestamp).toISOString();
}

export function isCampaignScheduledActive(
  campaign: Pick<Campaign, "active" | "startDate" | "startTime" | "expiryDate" | "endTime"> | null,
) {
  if (!campaign || !campaign.active) {
    return false;
  }

  const now = Date.now();
  const startAt = campaign.startDate ? getTurkeyDateTimeMs(campaign.startDate, campaign.startTime || "00:00") : null;
  const endAt = campaign.expiryDate ? getTurkeyDateTimeMs(campaign.expiryDate, campaign.endTime || "23:59", 59) : null;

  if (startAt !== null && startAt > now) {
    return false;
  }

  if (endAt !== null && endAt < now) {
    return false;
  }

  return true;
}
