import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_VERSION = 'cutplate-plan-cache-v5';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function buildPlanCacheKey(preferences = {}) {
  const fingerprint = buildPlanFingerprint(preferences);
  return createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex').slice(0, 24);
}

export async function getCachedPlan(preferences = {}) {
  if (isCacheDisabled()) return null;

  const key = buildPlanCacheKey(preferences);
  const filePath = getCacheFilePath(key);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const cached = JSON.parse(raw);
    const ttlMs = getCacheTtlMs();
    const createdAt = new Date(cached.createdAt || 0).getTime();
    const ageMs = Date.now() - createdAt;

    if (cached.version !== CACHE_VERSION || !cached.response || ageMs > ttlMs) {
      await fs.rm(filePath, { force: true });
      return null;
    }

    return stampCachedResponse(cached.response, preferences, {
      hit: true,
      key,
      createdAt: cached.createdAt,
      ageMs
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Plan cache read failed: ${error.message}`);
    }
    return null;
  }
}

export async function setCachedPlan(preferences = {}, response = {}) {
  if (isCacheDisabled() || !response?.plan) return null;

  const key = buildPlanCacheKey(preferences);
  const filePath = getCacheFilePath(key);
  const createdAt = new Date().toISOString();
  const payload = {
    version: CACHE_VERSION,
    key,
    createdAt,
    fingerprint: buildPlanFingerprint(preferences),
    response: sanitizeResponseForCache(response)
  };

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(payload), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    console.warn(`Plan cache write failed: ${error.message}`);
    return null;
  }

  return {
    hit: false,
    key,
    createdAt,
    ageMs: 0
  };
}

export async function listCachedRecipes({ ingredients = [], limit = 80 } = {}) {
  if (isCacheDisabled()) return [];

  const ingredientFilters = normalizeList(ingredients);
  const recipesByKey = new Map();

  try {
    const files = await fs.readdir(getCacheRoot());
    const ttlMs = getCacheTtlMs();

    for (const file of files.filter((name) => name.endsWith('.json'))) {
      try {
        const raw = await fs.readFile(path.join(getCacheRoot(), file), 'utf8');
        const cached = JSON.parse(raw);
        const createdAt = new Date(cached.createdAt || 0).getTime();
        if (!cached.response?.plan || Date.now() - createdAt > ttlMs) continue;

        for (const recipe of getRecipesFromCachedPlan(cached.response.plan)) {
          const searchable = [
            recipe.name,
            recipe.protein,
            recipe.mealType,
            recipe.description,
            ...(recipe.ingredients || [])
          ].join(' ').toLowerCase();
          const pantryScore = ingredientFilters.reduce(
            (score, ingredient) => score + (searchable.includes(ingredient) ? 1 : 0),
            0
          );

          if (ingredientFilters.length > 0 && pantryScore === 0) continue;

          const key = normalizeText(`${recipe.mealType}-${recipe.name}`);
          const existing = recipesByKey.get(key);
          const optionKey = `cached-${cached.key || file.replace(/\.json$/, '')}-${recipe.id || key}`.replace(/[^a-z0-9-]/gi, '-');

          if (!existing || pantryScore > existing.pantryScore) {
            recipesByKey.set(key, {
              ...recipe,
              id: optionKey,
              optionKey,
              cached: true,
              pantryScore,
              cachedAt: cached.createdAt
            });
          }
        }
      } catch (error) {
        console.warn(`Cached recipe read failed for ${file}: ${error.message}`);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Cached recipe list failed: ${error.message}`);
    }
  }

  return Array.from(recipesByKey.values())
    .sort((a, b) => b.pantryScore - a.pantryScore || String(b.cachedAt || '').localeCompare(String(a.cachedAt || '')))
    .slice(0, limit);
}

export function stampUncachedResponse(response = {}, preferences = {}) {
  return {
    ...response,
    plan: response.plan ? withCurrentPreferences(response.plan, preferences) : response.plan,
    cache: {
      hit: false,
      key: buildPlanCacheKey(preferences)
    }
  };
}

function getRecipesFromCachedPlan(plan = {}) {
  const library = Array.isArray(plan.recipeLibrary) ? plan.recipeLibrary : [];
  const plannedMeals = (plan.days || []).flatMap((day) => day.meals || []);
  return [...library, ...plannedMeals].filter((recipe) => recipe?.name && recipe?.mealType);
}

export function getCacheSettings() {
  return {
    enabled: !isCacheDisabled(),
    ttlMs: getCacheTtlMs(),
    directory: getCacheRoot()
  };
}

function stampCachedResponse(response, preferences, cache) {
  return {
    ...response,
    plan: response.plan ? withCurrentPreferences(response.plan, preferences) : response.plan,
    cache
  };
}

function sanitizeResponseForCache(response) {
  const { cache, ...cacheable } = response;
  return JSON.parse(JSON.stringify(cacheable));
}

function withCurrentPreferences(plan, preferences) {
  return {
    ...plan,
    preferences: {
      ...(plan.preferences || {}),
      ...preferences
    }
  };
}

function buildPlanFingerprint(preferences = {}) {
  return {
    version: CACHE_VERSION,
    days: Number(preferences.days || 0),
    proteins: normalizeList(preferences.proteins),
    mealSlots: normalizeMealSlots(preferences.mealSlots),
    servingsPerMeal: Number(preferences.servingsPerMeal || 0),
    allergies: normalizeList(preferences.allergies),
    location: normalizeText(preferences.location),
    groceryBudgetTier: getBudgetTier(preferences),
    calorieTarget: Number(preferences.calorieTarget || 0),
    dietStyle: normalizeText(preferences.dietStyle),
    avoidIngredients: normalizeText(preferences.avoidIngredients),
    pantryIngredients: normalizeText(preferences.pantryIngredients),
    weekdaysOnly: Boolean(preferences.weekdaysOnly),
    sourceHandles: normalizeList(preferences.sourceHandles)
  };
}

function normalizeMealSlots(mealSlots = []) {
  const order = ['breakfast', 'lunch', 'dinner', 'snack'];
  return (mealSlots || [])
    .map((slot) => ({
      type: normalizeText(slot.type || slot.mealType),
      time: normalizeText(slot.time)
    }))
    .filter((slot) => slot.type)
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.time.localeCompare(b.time));
}

function normalizeList(values = []) {
  return [...new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))].sort();
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getBudgetTier(preferences = {}) {
  const budget = Number(preferences.groceryBudget || preferences.budgetTarget || 0);
  if (!Number.isFinite(budget) || budget <= 0) return 'standard';

  const days = Number(preferences.days || 1);
  const mealCount = Array.isArray(preferences.mealSlots) && preferences.mealSlots.length
    ? preferences.mealSlots.length
    : 1;
  const budgetPerRecipe = budget / Math.max(1, days * mealCount);

  if (budgetPerRecipe < 7) return 'low';
  if (budgetPerRecipe >= 10) return 'high';
  return 'standard';
}

function getCacheFilePath(key) {
  return path.join(getCacheRoot(), `${key}.json`);
}

function getCacheRoot() {
  return process.env.PLAN_CACHE_DIR
    ? path.resolve(process.env.PLAN_CACHE_DIR)
    : path.resolve(__dirname, '..', '.cache', 'plans');
}

function getCacheTtlMs() {
  const configured = Number(process.env.PLAN_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_MS;
}

function isCacheDisabled() {
  return /^(1|true|yes)$/i.test(String(process.env.PLAN_CACHE_DISABLED || ''));
}
