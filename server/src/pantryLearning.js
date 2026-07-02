import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const analyticsPath = path.resolve(__dirname, '..', '.cache', 'analytics-events.jsonl');
const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

const MAX_EVENTS = 200;
const MAX_ITEMS = 60;
const MAX_HINTS = 10;

export async function getPantryLearningProfile(identity = {}) {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return null;

  try {
    const events = pool
      ? await readDatabaseEvents(normalizedIdentity)
      : await readLocalEvents(normalizedIdentity);
    return buildPantryLearningProfile(events, normalizedIdentity);
  } catch (error) {
    console.warn('Pantry learning profile read failed:', error?.message || error);
    return null;
  }
}

export function buildPantryScanFeedback(input = {}) {
  const detectedItems = normalizeIngredientList(input.detectedIngredients || input.detectedItems);
  const finalItems = normalizeIngredientList(input.finalIngredients || input.finalItems);
  const confirmedItems = detectedItems.filter((item) => (
    finalItems.some((candidate) => ingredientsOverlap(item, candidate))
  ));
  const addedItems = finalItems.filter((item) => (
    !detectedItems.some((candidate) => ingredientsOverlap(item, candidate))
  ));
  const removedItems = detectedItems.filter((item) => (
    !finalItems.some((candidate) => ingredientsOverlap(item, candidate))
  ));

  return {
    mealType: cleanLabel(input.mealType, 40),
    detectedItems,
    finalItems,
    confirmedItems,
    addedItems,
    removedItems,
    detectedCount: detectedItems.length,
    finalIngredientCount: finalItems.length,
    confirmedCount: confirmedItems.length,
    userAddedCount: addedItems.length,
    removedCount: removedItems.length,
    correctionRatePct: detectedItems.length
      ? Number((((addedItems.length + removedItems.length) / detectedItems.length) * 100).toFixed(1))
      : null
  };
}

export function buildPantryLearningProfile(events = [], identity = {}) {
  const addedCounts = {};
  const removedCounts = {};
  const confirmedCounts = {};
  let correctionCount = 0;
  let updatedAt = null;

  for (const event of events) {
    const eventName = String(event.eventName || event.event_name || '').trim().toLowerCase();
    if (eventName !== 'pantry_scan_confirmed') continue;

    const properties = parseProperties(event.properties);
    const addedItems = normalizeIngredientList(properties.addedItems);
    const removedItems = normalizeIngredientList(properties.removedItems);
    const confirmedItems = normalizeIngredientList(properties.confirmedItems);
    if (!addedItems.length && !removedItems.length && !confirmedItems.length) continue;

    correctionCount += 1;
    addCounts(addedCounts, addedItems);
    addCounts(removedCounts, removedItems);
    addCounts(confirmedCounts, confirmedItems);

    const createdAt = toIsoString(event.createdAt || event.created_at);
    if (createdAt && (!updatedAt || createdAt > updatedAt)) updatedAt = createdAt;
  }

  if (!correctionCount) return null;

  const frequentlyAdded = rankItems(addedCounts);
  const frequentlyRemoved = Object.entries(removedCounts)
    .map(([name, count]) => ({
      name,
      count,
      confirmedCount: Number(confirmedCounts[name] || 0)
    }))
    .filter((item) => item.count > item.confirmedCount)
    .sort((left, right) => (
      (right.count - right.confirmedCount) - (left.count - left.confirmedCount)
      || right.count - left.count
      || left.name.localeCompare(right.name)
    ))
    .slice(0, MAX_HINTS);

  return {
    userId: identity.userId || null,
    email: identity.email || null,
    correctionCount,
    frequentlyAdded,
    frequentlyRemoved,
    updatedAt
  };
}

export function getPantryLearningSummary(profile) {
  if (!profile?.correctionCount) {
    return {
      active: false,
      correctionCount: 0
    };
  }

  return {
    active: true,
    correctionCount: profile.correctionCount,
    frequentlyAddedCount: profile.frequentlyAdded?.length || 0,
    frequentlyRemovedCount: profile.frequentlyRemoved?.length || 0,
    updatedAt: profile.updatedAt
  };
}

export function buildPantryLearningGuidance(profile) {
  if (!profile?.correctionCount) return '';

  const guidance = [];
  const added = (profile.frequentlyAdded || []).map((item) => item.name).slice(0, MAX_HINTS);
  const removed = (profile.frequentlyRemoved || []).map((item) => item.name).slice(0, MAX_HINTS);

  if (added.length) {
    guidance.push(
      `This account previously added these missed items during scan review: ${added.join(', ')}. Look carefully for them, but return them only when visible or supported by readable packaging.`
    );
  }
  if (removed.length) {
    guidance.push(
      `This account previously removed these false or unclear detections: ${removed.join(', ')}. Be especially conservative with those labels and return them only when clearly visible.`
    );
  }

  return guidance.join(' ');
}

function normalizeIngredientList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const output = [];
  const seen = new Set();

  for (const item of source) {
    const label = normalizeIngredientName(
      item && typeof item === 'object' ? item.name : item
    );
    if (!label || seen.has(label)) continue;
    seen.add(label);
    output.push(label);
    if (output.length >= MAX_ITEMS) break;
  }

  return output;
}

function normalizeIngredientName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%+\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 100)
    .trim();
}

function ingredientsOverlap(left = '', right = '') {
  const leftName = normalizeIngredientName(left);
  const rightName = normalizeIngredientName(right);
  return Boolean(
    leftName
    && rightName
    && (leftName === rightName || leftName.includes(rightName) || rightName.includes(leftName))
  );
}

function addCounts(counts, items) {
  items.forEach((item) => {
    counts[item] = Number(counts[item] || 0) + 1;
  });
}

function rankItems(counts) {
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, MAX_HINTS);
}

async function readDatabaseEvents(identity) {
  const conditions = [];
  const values = [];

  if (identity.userId) {
    values.push(identity.userId);
    conditions.push(`user_id = $${values.length}`);
  }
  if (identity.email) {
    values.push(identity.email);
    conditions.push(`lower(email) = $${values.length}`);
  }

  values.push(MAX_EVENTS);
  const result = await pool.query(
    `select created_at, event_name, properties
     from public.analytics_events
     where (${conditions.join(' or ')})
       and event_name = 'pantry_scan_confirmed'
     order by created_at desc
     limit $${values.length}`,
    values
  );
  return result.rows;
}

async function readLocalEvents(identity) {
  const raw = await readFile(analyticsPath, 'utf8').catch(() => '');
  if (!raw) return [];

  return raw
    .trim()
    .split('\n')
    .reverse()
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((event) => (
      event
      && String(event.eventName || event.event_name || '').toLowerCase() === 'pantry_scan_confirmed'
      && eventMatchesIdentity(event, identity)
    ))
    .slice(0, MAX_EVENTS);
}

function eventMatchesIdentity(event, identity) {
  const eventUserId = String(event.userId || event.user_id || '').trim();
  const eventEmail = String(event.email || '').trim().toLowerCase();
  return Boolean(
    (identity.userId && eventUserId === identity.userId)
    || (identity.email && eventEmail === identity.email)
  );
}

function normalizeIdentity(identity = {}) {
  const userId = String(identity.userId || identity.user_id || '').trim().slice(0, 120);
  const emailValue = String(identity.email || '').trim().toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) ? emailValue.slice(0, 240) : '';
  return userId || email ? { userId: userId || null, email: email || null } : null;
}

function parseProperties(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanLabel(value, maxLength) {
  const label = String(value || '').trim().replace(/\s+/g, ' ');
  return label ? label.slice(0, maxLength) : null;
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
