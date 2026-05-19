import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '..', '.cache');
const analyticsPath = path.join(cacheDir, 'analytics-events.jsonl');
const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

export function getAnalyticsSettings() {
  return {
    enabled: true,
    storage: pool ? 'database' : 'local-cache'
  };
}

export async function trackAnalyticsEvent(input = {}) {
  const event = normalizeAnalyticsEvent(input);

  if (pool) {
    return insertDatabaseEvent(event);
  }

  await mkdir(cacheDir, { recursive: true });
  await appendFile(analyticsPath, `${JSON.stringify({ id: randomUUID(), createdAt: new Date().toISOString(), ...event })}\n`);
  return { ok: true, storage: 'local-cache' };
}

async function insertDatabaseEvent(event) {
  try {
    await pool.query(
      `insert into public.analytics_events (
          user_id,
          email,
          anonymous_id,
          event_name,
          properties,
          app_version,
          platform
        )
        values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.userId,
        event.email,
        event.anonymousId,
        event.eventName,
        event.properties,
        event.appVersion,
        event.platform
      ]
    );
    return { ok: true, storage: 'database' };
  } catch (error) {
    if (error?.code !== '42703') {
      throw error;
    }

    await pool.query(
      `insert into public.analytics_events (
          user_id,
          email,
          anonymous_id,
          event_name
        )
        values ($1, $2, $3, $4)`,
      [event.userId, event.email, event.anonymousId, event.eventName]
    );
    return { ok: true, storage: 'database', schema: 'basic' };
  }
}

function normalizeAnalyticsEvent(input = {}) {
  const eventName = String(input.eventName || input.event_name || '').trim().toLowerCase();
  if (!/^[a-z0-9_:-]{1,80}$/.test(eventName)) {
    const error = new Error('A valid event_name is required.');
    error.status = 400;
    throw error;
  }

  return {
    userId: cleanText(input.userId || input.user_id, 120),
    email: cleanEmail(input.email),
    anonymousId: cleanText(input.anonymousId || input.anonymous_id, 120),
    eventName,
    properties: cleanProperties(input.properties),
    appVersion: cleanText(input.appVersion || input.app_version, 40),
    platform: cleanText(input.platform, 40)
  };
}

function cleanText(value, maxLength) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 240) : null;
}

function cleanProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  try {
    const json = JSON.stringify(value);
    if (json.length > 12000) {
      return {
        truncated: true,
        originalSize: json.length
      };
    }
    return JSON.parse(json);
  } catch {
    return {};
  }
}
