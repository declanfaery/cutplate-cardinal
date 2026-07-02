import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '..', '.cache');
const defaultLearningPath = path.join(cacheDir, 'price-learning.json');
const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

const MIN_ACCEPTED_RATIO = 0.35;
const MAX_ACCEPTED_RATIO = 2.5;
const MIN_SAMPLE_RATIO = 0.65;
const MAX_SAMPLE_RATIO = 1.65;
const MIN_LEARNED_MULTIPLIER = 0.8;
const MAX_LEARNED_MULTIPLIER = 1.35;
const MIN_LEARNING_SAMPLES = 3;
const MIN_DISTINCT_IDENTITIES = 2;
const PRIOR_STRENGTH = 8;
const HALF_LIFE_DAYS = 120;
const MAX_OBSERVATIONS = 5000;

let loadedPath = '';
let learningState = createEmptyLearningState();
let initializationPromise = null;
let refreshTimer = null;

export function initializePriceLearning() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = pool
    ? refreshDatabaseLearningState()
    : Promise.resolve(loadLocalLearningState());

  if (pool && !refreshTimer) {
    refreshTimer = setInterval(() => {
      void refreshDatabaseLearningState().catch((error) => {
        console.warn('Price learning refresh failed:', error?.message || error);
      });
    }, 300_000);
    refreshTimer.unref?.();
  }

  return initializationPromise;
}

export function getPriceLearningSettings() {
  return {
    storage: learningState.storage,
    observations: learningState.observations.length,
    eligibleAggregates: Object.values(learningState.aggregates)
      .filter((aggregate) => aggregate.eligible)
      .length,
    minimumSamples: MIN_LEARNING_SAMPLES,
    minimumContributors: MIN_DISTINCT_IDENTITIES,
    updatedAt: learningState.updatedAt
  };
}

export async function recordGroceryPriceFeedback(properties = {}, options = {}) {
  const sample = normalizeFeedbackSample(properties);
  if (!sample) {
    return { recorded: false, learned: false, reason: 'missing_or_outlier_total' };
  }

  await initializePriceLearning();
  let created;

  if (pool && options.persist !== false) {
    created = await upsertDatabaseObservation(sample);
    await refreshDatabaseLearningState();
  } else {
    created = upsertLocalObservation(sample);
    if (options.persist !== false) await persistLocalLearningState();
  }

  const adjustment = getLearnedPriceAdjustment({
    market: sample.market,
    currency: sample.currency,
    storeName: sample.storeName
  });

  return {
    recorded: true,
    created,
    duplicate: !created,
    learned: adjustment.applied,
    feedbackId: sample.feedbackId,
    ratio: sample.ratio,
    rawRatio: sample.rawRatio,
    userRating: sample.userRating,
    derivedRating: sample.derivedRating,
    multiplier: adjustment.multiplier,
    source: adjustment.source,
    samples: adjustment.samples,
    distinctIdentities: adjustment.distinctIdentities,
    confidence: adjustment.confidence
  };
}

export function getLearnedPriceAdjustment({ market = '', currency = '', storeName = '' } = {}) {
  if (!pool) loadLocalLearningState();

  const sample = {
    market: normalizeKeyPart(market || 'global'),
    currency: normalizeCurrency(currency),
    storeName: normalizeStoreName(storeName)
  };
  const storeKey = buildStoreKey(sample);
  const marketKey = buildMarketKey(sample);
  const storeAggregate = storeKey ? learningState.aggregates[storeKey] : null;
  const marketAggregate = learningState.aggregates[marketKey];
  const selected = storeAggregate?.eligible
    ? { ...storeAggregate, source: 'store' }
    : marketAggregate?.eligible
      ? { ...marketAggregate, source: 'market' }
      : null;
  const pending = storeAggregate || marketAggregate;

  if (!selected) {
    return {
      applied: false,
      multiplier: 1,
      source: 'base',
      samples: Number(pending?.samples || 0),
      distinctIdentities: Number(pending?.distinctIdentities || 0),
      confidence: Number(pending?.confidence || 0),
      reason: pending ? 'insufficient_independent_samples' : 'no_samples'
    };
  }

  const multiplier = clamp(
    Number(selected.multiplier),
    MIN_LEARNED_MULTIPLIER,
    MAX_LEARNED_MULTIPLIER
  );

  return {
    applied: Math.abs(multiplier - 1) >= 0.005,
    multiplier,
    source: selected.source,
    samples: Number(selected.samples || 0),
    distinctIdentities: Number(selected.distinctIdentities || 0),
    confidence: Number(selected.confidence || 0),
    averageRatio: Number(selected.averageRatio || multiplier),
    medianRatio: Number(selected.medianRatio || multiplier),
    lastRatio: Number(selected.lastRatio || multiplier),
    updatedAt: selected.updatedAt || null
  };
}

export async function deleteGroceryPriceObservations(identity = {}) {
  const userId = cleanText(identity.userId || identity.user_id, 120);
  const email = normalizeEmail(identity.email);
  if (!userId && !email) return;

  await initializePriceLearning();

  if (pool) {
    const conditions = [];
    const values = [];
    if (userId) {
      values.push(userId);
      conditions.push(`user_id = $${values.length}`);
    }
    if (email) {
      values.push(email);
      conditions.push(`lower(email) = $${values.length}`);
    }
    await pool.query(
      `delete from public.grocery_price_observations where ${conditions.join(' or ')}`,
      values
    );
    await refreshDatabaseLearningState();
    return;
  }

  learningState.observations = learningState.observations.filter((observation) => (
    !(userId && observation.userId === userId)
    && !(email && observation.email === email)
  ));
  rebuildAggregates();
  await persistLocalLearningState();
}

export function resetPriceLearningForTests(nextState = null) {
  loadedPath = getLearningPath();
  learningState = nextState || createEmptyLearningState();
  initializationPromise = Promise.resolve();
}

function normalizeFeedbackSample(properties = {}) {
  const estimatedTotal = Number(properties.estimatedTotal);
  const actualTotal = Number(properties.actualTotal);

  if (!Number.isFinite(estimatedTotal) || !Number.isFinite(actualTotal)) return null;
  if (estimatedTotal <= 5 || actualTotal <= 5) return null;

  const rawRatio = actualTotal / estimatedTotal;
  if (!Number.isFinite(rawRatio) || rawRatio < MIN_ACCEPTED_RATIO || rawRatio > MAX_ACCEPTED_RATIO) {
    return null;
  }

  const identity = {
    userId: cleanText(properties.userId || properties.user_id, 120),
    email: normalizeEmail(properties.email),
    anonymousId: cleanText(properties.anonymousId || properties.anonymous_id, 120)
  };
  const market = normalizeKeyPart(
    properties.coarseMarket || properties.market || properties.region || 'global'
  );
  const currency = normalizeCurrency(properties.currency || properties.currencyCode);
  const storeName = cleanStoreName(properties.storeName);
  const planId = cleanText(properties.planId || properties.plan_id, 160);
  const feedbackId = cleanText(properties.feedbackId || properties.feedback_id, 200)
    || buildFallbackFeedbackId({
      ...identity,
      planId,
      market,
      storeName,
      estimatedTotal,
      actualTotal
    });

  return {
    feedbackId,
    planId,
    ...identity,
    identityKey: buildIdentityKey(identity, feedbackId),
    estimatedTotal: roundMoney(estimatedTotal),
    actualTotal: roundMoney(actualTotal),
    ratio: roundMultiplier(clamp(rawRatio, MIN_SAMPLE_RATIO, MAX_SAMPLE_RATIO)),
    rawRatio: roundMultiplier(rawRatio),
    market,
    currency,
    storeName,
    userRating: normalizeRating(properties.rating),
    derivedRating: deriveRating(rawRatio),
    estimatedLineItems: sanitizeLineItems(
      properties.estimatedLineItems || properties.lineItems
    ),
    appVersion: cleanText(properties.appVersion || properties.app_version, 40),
    platform: cleanText(properties.platform, 40),
    createdAt: toIsoString(properties.createdAt || properties.created_at) || new Date().toISOString()
  };
}

async function upsertDatabaseObservation(sample) {
  const values = [
    sample.feedbackId,
    sample.userId,
    sample.email,
    sample.anonymousId,
    sample.planId,
    sample.market,
    sample.storeName || null,
    sample.currency,
    sample.estimatedTotal,
    sample.actualTotal,
    sample.rawRatio,
    sample.ratio,
    sample.userRating,
    sample.derivedRating,
    JSON.stringify(sample.estimatedLineItems),
    sample.appVersion,
    sample.platform,
    sample.createdAt
  ];
  const inserted = await pool.query(
    `insert into public.grocery_price_observations (
       feedback_id,
       user_id,
       email,
       anonymous_id,
       plan_id,
       market,
       store_name,
       currency,
       estimated_total,
       actual_total,
       raw_ratio,
       clamped_ratio,
       user_rating,
       derived_rating,
       estimated_line_items,
       app_version,
       platform,
       created_at
     )
     values (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18
     )
     on conflict (feedback_id) do nothing
     returning id`,
    values
  );
  if (inserted.rowCount > 0) return true;

  await pool.query(
    `update public.grocery_price_observations
     set
       updated_at = now(),
       user_id = $2,
       email = $3,
       anonymous_id = $4,
       plan_id = $5,
       market = $6,
       store_name = $7,
       currency = $8,
       estimated_total = $9,
       actual_total = $10,
       raw_ratio = $11,
       clamped_ratio = $12,
       user_rating = $13,
       derived_rating = $14,
       estimated_line_items = $15::jsonb,
       app_version = $16,
       platform = $17
     where feedback_id = $1`,
    values.slice(0, 17)
  );
  return false;
}

function upsertLocalObservation(sample) {
  const index = learningState.observations.findIndex(
    (observation) => observation.feedbackId === sample.feedbackId
  );
  if (index >= 0) {
    learningState.observations[index] = {
      ...sample,
      createdAt: learningState.observations[index].createdAt || sample.createdAt,
      updatedAt: new Date().toISOString()
    };
    rebuildAggregates();
    return false;
  }

  learningState.observations.push({
    ...sample,
    updatedAt: sample.createdAt
  });
  learningState.observations = learningState.observations.slice(-MAX_OBSERVATIONS);
  rebuildAggregates();
  return true;
}

async function refreshDatabaseLearningState() {
  try {
    const result = await pool.query(
      `select
         feedback_id,
         created_at,
         updated_at,
         user_id,
         email,
         anonymous_id,
         plan_id,
         market,
         store_name,
         currency,
         estimated_total,
         actual_total,
         raw_ratio,
         clamped_ratio,
         user_rating,
         derived_rating,
         estimated_line_items,
         app_version,
         platform
       from public.grocery_price_observations
       order by created_at desc
       limit $1`,
      [MAX_OBSERVATIONS]
    );
    learningState = {
      version: 2,
      storage: 'database',
      updatedAt: new Date().toISOString(),
      observations: result.rows.reverse().map(databaseRowToObservation),
      aggregates: {}
    };
    rebuildAggregates();
  } catch (error) {
    if (error?.code === '42P01') {
      console.warn('Price learning table is missing; run the grocery price observations migration.');
      learningState = createEmptyLearningState();
      return;
    }
    throw error;
  }
}

function rebuildAggregates() {
  const grouped = new Map();

  for (const observation of learningState.observations) {
    for (const key of [
      buildMarketKey(observation),
      buildStoreKey(observation)
    ].filter(Boolean)) {
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(observation);
    }
  }

  learningState.aggregates = Object.fromEntries(
    [...grouped.entries()].map(([key, observations]) => [
      key,
      summarizeObservations(observations)
    ])
  );
  learningState.updatedAt = new Date().toISOString();
}

function summarizeObservations(observations = []) {
  const now = Date.now();
  const weighted = observations.map((observation) => {
    const ageDays = Math.max(
      0,
      (now - new Date(observation.createdAt || now).getTime()) / 86_400_000
    );
    return {
      ratio: Number(observation.ratio || 1),
      weight: 0.5 ** (ageDays / HALF_LIFE_DAYS)
    };
  });
  const totalWeight = weighted.reduce((total, item) => total + item.weight, 0);
  const averageRatio = totalWeight > 0
    ? weighted.reduce((total, item) => total + item.ratio * item.weight, 0) / totalWeight
    : 1;
  const ratios = observations.map((observation) => Number(observation.ratio || 1)).sort((a, b) => a - b);
  const medianRatio = median(ratios);
  const distinctIdentities = new Set(
    observations.map((observation) => observation.identityKey).filter(Boolean)
  ).size;
  const eligible = observations.length >= MIN_LEARNING_SAMPLES
    && distinctIdentities >= MIN_DISTINCT_IDENTITIES;
  const confidence = eligible
    ? Math.min(1, totalWeight / (PRIOR_STRENGTH + totalWeight))
    : 0;
  const robustRatio = (averageRatio + medianRatio) / 2;
  const multiplier = clamp(
    1 + ((robustRatio - 1) * confidence),
    MIN_LEARNED_MULTIPLIER,
    MAX_LEARNED_MULTIPLIER
  );
  const latest = observations.at(-1);

  return {
    samples: observations.length,
    distinctIdentities,
    eligible,
    confidence: roundMultiplier(confidence),
    multiplier: roundMultiplier(multiplier),
    averageRatio: roundMultiplier(averageRatio),
    medianRatio: roundMultiplier(medianRatio),
    lastRatio: roundMultiplier(Number(latest?.ratio || 1)),
    updatedAt: latest?.updatedAt || latest?.createdAt || null
  };
}

function loadLocalLearningState() {
  const learningPath = getLearningPath();
  if (loadedPath === learningPath && learningState.storage === 'local-cache') return learningState;

  loadedPath = learningPath;
  if (!existsSync(learningPath)) {
    learningState = createEmptyLearningState();
    return learningState;
  }

  try {
    const parsed = JSON.parse(readFileSync(learningPath, 'utf8'));
    learningState = {
      version: 2,
      storage: 'local-cache',
      updatedAt: parsed.updatedAt || null,
      observations: Array.isArray(parsed.observations) ? parsed.observations : [],
      aggregates: {}
    };
    rebuildAggregates();
  } catch {
    learningState = createEmptyLearningState();
  }
  return learningState;
}

async function persistLocalLearningState() {
  const learningPath = getLearningPath();
  await mkdir(path.dirname(learningPath), { recursive: true });
  await writeFile(
    learningPath,
    `${JSON.stringify({
      version: 2,
      updatedAt: learningState.updatedAt,
      observations: learningState.observations
    }, null, 2)}\n`
  );
}

function databaseRowToObservation(row) {
  const feedbackId = String(row.feedback_id || '');
  const identity = {
    userId: cleanText(row.user_id, 120),
    email: normalizeEmail(row.email),
    anonymousId: cleanText(row.anonymous_id, 120)
  };
  return {
    feedbackId,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    ...identity,
    identityKey: buildIdentityKey(identity, feedbackId),
    planId: cleanText(row.plan_id, 160),
    market: normalizeKeyPart(row.market),
    storeName: cleanStoreName(row.store_name),
    currency: normalizeCurrency(row.currency),
    estimatedTotal: Number(row.estimated_total),
    actualTotal: Number(row.actual_total),
    rawRatio: Number(row.raw_ratio),
    ratio: Number(row.clamped_ratio),
    userRating: normalizeRating(row.user_rating),
    derivedRating: normalizeRating(row.derived_rating),
    estimatedLineItems: sanitizeLineItems(row.estimated_line_items),
    appVersion: cleanText(row.app_version, 40),
    platform: cleanText(row.platform, 40)
  };
}

function sanitizeLineItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 120).map((item) => ({
    name: cleanText(item?.name, 160),
    unit: cleanText(item?.unit, 40),
    quantity: finiteNumber(item?.quantity),
    ounces: finiteNumber(item?.ounces),
    costUnits: finiteNumber(item?.costUnits),
    purchaseQuantity: finiteNumber(item?.purchaseQuantity),
    quantityLabel: cleanText(item?.quantityLabel, 240),
    estimatedCost: finiteNumber(item?.estimatedCost)
  })).filter((item) => item.name);
}

function buildMarketKey(sample = {}) {
  return `market:${normalizeKeyPart(sample.market || 'global')}:${normalizeCurrency(sample.currency)}`;
}

function buildStoreKey(sample = {}) {
  const store = normalizeStoreName(sample.storeName);
  return store
    ? `store:${normalizeKeyPart(sample.market || 'global')}:${normalizeCurrency(sample.currency)}:${store}`
    : '';
}

function buildFallbackFeedbackId(sample = {}) {
  const identity = sample.userId || sample.email || sample.anonymousId || 'anonymous';
  const raw = [
    identity,
    sample.planId || '',
    sample.market,
    sample.storeName,
    Number(sample.estimatedTotal).toFixed(2),
    Number(sample.actualTotal).toFixed(2)
  ].join('|');
  return `feedback-${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}

function buildIdentityKey(identity = {}, fallback = '') {
  if (identity.userId) return `user:${identity.userId}`;
  if (identity.email) return `email:${identity.email}`;
  if (identity.anonymousId) return `anonymous:${identity.anonymousId}`;
  return fallback ? `observation:${fallback}` : '';
}

function deriveRating(ratio) {
  if (ratio > 1.08) return 'too_low';
  if (ratio < 0.92) return 'too_high';
  return 'close';
}

function normalizeRating(value = '') {
  const rating = String(value || '').trim().toLowerCase();
  return ['too_low', 'close', 'too_high'].includes(rating) ? rating : null;
}

function normalizeCurrency(value = '') {
  return String(value || 'USD').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'USD';
}

function cleanStoreName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeStoreName(value = '') {
  return normalizeKeyPart(value).slice(0, 80);
}

function normalizeKeyPart(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'global';
}

function normalizeEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 240) : null;
}

function cleanText(value, maxLength) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : null;
}

function median(values = []) {
  if (!values.length) return 1;
  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : (values[middle - 1] + values[middle]) / 2;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function roundMultiplier(value) {
  const number = Number(value);
  return Math.round((Number.isFinite(number) ? number : 1) * 1000) / 1000;
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createEmptyLearningState() {
  return {
    version: 2,
    storage: pool ? 'database' : 'local-cache',
    updatedAt: null,
    observations: [],
    aggregates: {}
  };
}

function getLearningPath() {
  return String(process.env.PRICE_LEARNING_PATH || defaultLearningPath).trim() || defaultLearningPath;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
