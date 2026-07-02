import { readFile, writeFile } from 'node:fs/promises';
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

const MAX_EVENTS = 600;
const HALF_LIFE_DAYS = 120;
const SUPPORTED_EVENTS = new Set([
  'calendar_meal_added',
  'menu_selected',
  'recipe_added_to_calendar',
  'recipe_repeated',
  'recipe_saved',
  'recipe_selection_changed',
  'recipe_swapped',
  'recipe_unsaved'
]);
const STYLE_PATTERNS = {
  'air fryer': /\bair[- ]?fry(?:er|ied)?\b/i,
  bake: /\b(?:bake|baked|casserole)\b/i,
  bowl: /\bbowl\b/i,
  curry: /\bcurry\b/i,
  kebab: /\b(?:kebab|kabob|skewer)\b/i,
  pasta: /\b(?:pasta|penne|spaghetti|linguine|macaroni|orzo|noodle)\b/i,
  pizza: /\b(?:pizza|flatbread)\b/i,
  salad: /\bsalad\b/i,
  sandwich: /\b(?:sandwich|burger|slider)\b/i,
  skillet: /\bskillet\b/i,
  soup: /\b(?:soup|stew|chowder|chili)\b/i,
  taco: /\b(?:taco|tostada|quesadilla|burrito)\b/i,
  toast: /\btoast\b/i,
  wrap: /\b(?:wrap|lettuce cup)\b/i
};
const INGREDIENT_TERMS = [
  'avocado',
  'beans',
  'bell pepper',
  'broccoli',
  'brown rice',
  'cabbage',
  'carrot',
  'cauliflower',
  'cheddar',
  'chickpeas',
  'cottage cheese',
  'cucumber',
  'egg',
  'feta',
  'greek yogurt',
  'green beans',
  'kale',
  'lentils',
  'mango',
  'mushroom',
  'mozzarella',
  'oats',
  'onion',
  'parmesan',
  'peanut',
  'peas',
  'pesto',
  'potato',
  'quinoa',
  'rice',
  'salsa',
  'spinach',
  'sweet potato',
  'tomato',
  'tortilla',
  'zucchini'
];

export async function getRecipePreferenceProfile(identity = {}) {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return null;

  try {
    const events = pool
      ? await readDatabaseEvents(normalizedIdentity)
      : await readLocalEvents(normalizedIdentity);
    return buildRecipePreferenceProfile(events, normalizedIdentity);
  } catch (error) {
    console.warn('Preference profile read failed:', error?.message || error);
    return null;
  }
}

export async function deleteRecipePreferenceData(identity = {}) {
  const normalizedIdentity = normalizeIdentity(identity);
  if (!normalizedIdentity) return;

  try {
    if (pool) {
      await deleteDatabaseEvents(normalizedIdentity);
      return;
    }

    const raw = await readFile(analyticsPath, 'utf8').catch(() => '');
    if (!raw) return;

    const retained = raw
      .split('\n')
      .filter(Boolean)
      .filter((line) => {
        try {
          return !eventMatchesIdentity(JSON.parse(line), normalizedIdentity);
        } catch {
          return true;
        }
      });
    await writeFile(analyticsPath, retained.length ? `${retained.join('\n')}\n` : '', 'utf8');
  } catch (error) {
    console.warn('Preference data deletion failed:', error?.message || error);
  }
}

export function buildRecipePreferenceProfile(events = [], identity = {}, now = new Date()) {
  const profile = {
    userId: identity.userId || null,
    email: identity.email || null,
    signalCount: 0,
    positiveSignalCount: 0,
    negativeSignalCount: 0,
    scores: {
      proteins: {},
      mealTypes: {},
      ingredients: {},
      styles: {},
      recipes: {}
    },
    recentRecipes: {},
    updatedAt: null
  };
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  const orderedEvents = [...events].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.created_at || 0).getTime();
    const rightTime = new Date(right.createdAt || right.created_at || 0).getTime();
    return leftTime - rightTime;
  });

  for (const event of orderedEvents) {
    const eventName = String(event.eventName || event.event_name || '').toLowerCase();
    if (!SUPPORTED_EVENTS.has(eventName)) continue;

    const createdAt = toIsoString(event.createdAt || event.created_at) || new Date(nowMs).toISOString();
    const ageDays = Math.max(0, (nowMs - new Date(createdAt).getTime()) / 86_400_000);
    const timeWeight = 0.5 ** (ageDays / HALF_LIFE_DAYS);
    const signals = getEventSignals(eventName, parseProperties(event.properties));

    for (const signal of signals) {
      const weight = Number(signal.weight || 0) * timeWeight;
      if (!Number.isFinite(weight) || weight === 0) continue;

      applyRecipeSignal(profile, signal.recipe, weight, createdAt, {
        exactOnly: Boolean(signal.exactOnly)
      });
      profile.signalCount += 1;
      if (weight > 0) profile.positiveSignalCount += 1;
      if (weight < 0) profile.negativeSignalCount += 1;
      if (!profile.updatedAt || createdAt > profile.updatedAt) profile.updatedAt = createdAt;
    }
  }

  if (!profile.signalCount) return null;
  profile.scores = compactScoreGroups(profile.scores);
  profile.recentRecipes = compactRecentRecipes(profile.recentRecipes);
  return profile;
}

export function personalizeRecipeLibrary(recipes = [], profile = null, options = {}) {
  if (!profile?.signalCount || !Array.isArray(recipes) || recipes.length < 2) {
    return Array.isArray(recipes) ? recipes : [];
  }

  const allowExactRepeats = Boolean(options.allowExactRepeats);
  const grouped = new Map();

  recipes.forEach((recipe, index) => {
    const mealType = normalizeLabel(recipe?.mealType || 'Meal');
    if (!grouped.has(mealType)) grouped.set(mealType, []);
    grouped.get(mealType).push(scoreRecipeCandidate(recipe, profile, index, { allowExactRepeats }));
  });

  const rankedGroups = new Map(
    [...grouped.entries()].map(([mealType, candidates]) => [
      mealType,
      interleaveExploration(candidates)
    ])
  );
  const cursors = new Map([...rankedGroups.keys()].map((key) => [key, 0]));

  return recipes.map((recipe) => {
    const mealType = normalizeLabel(recipe?.mealType || 'Meal');
    const cursor = cursors.get(mealType) || 0;
    const candidate = rankedGroups.get(mealType)?.[cursor];
    cursors.set(mealType, cursor + 1);
    return candidate?.recipe || recipe;
  });
}

export function getPreferenceLearningSummary(profile) {
  if (!profile?.signalCount) {
    return {
      active: false,
      signalCount: 0
    };
  }

  return {
    active: true,
    signalCount: profile.signalCount,
    positiveSignalCount: profile.positiveSignalCount,
    negativeSignalCount: profile.negativeSignalCount,
    topProteins: topPositiveKeys(profile.scores.proteins, 3),
    topIngredients: topPositiveKeys(profile.scores.ingredients, 5),
    topStyles: topPositiveKeys(profile.scores.styles, 3),
    updatedAt: profile.updatedAt
  };
}

function scoreRecipeCandidate(recipe, profile, index, { allowExactRepeats }) {
  const features = getRecipeFeatures(recipe);
  const recipeKey = normalizeRecipeName(recipe?.name);
  const recipeScore = Number(profile.scores.recipes[recipeKey] || 0);
  const recent = profile.recentRecipes[recipeKey];
  let score = 0;

  score += Number(profile.scores.proteins[features.protein] || 0) * 1.4;
  score += Number(profile.scores.mealTypes[features.mealType] || 0) * 0.2;
  score += averageFeatureScore(features.ingredients, profile.scores.ingredients) * 0.55;
  score += averageFeatureScore(features.styles, profile.scores.styles) * 0.9;

  if (recipeScore < 0) {
    score += recipeScore * 2.4;
  } else if (recipeScore > 0 && !allowExactRepeats) {
    const recencyMultiplier = recent && daysSince(recent.lastAt) < 45 ? 1.25 : 0.75;
    score -= Math.min(30, (8 + recipeScore * 2.5) * recencyMultiplier);
  } else if (allowExactRepeats) {
    score += recipeScore;
  }

  const reason = getRecommendationReason(features, profile, recipeScore);
  const personalized = score > 1.75 && Boolean(reason);

  return {
    index,
    score,
    novel: !recent,
    recipe: {
      ...recipe,
      personalized,
      preferenceScore: Number(score.toFixed(3)),
      recommendationReason: personalized ? reason : null
    }
  };
}

function interleaveExploration(candidates = []) {
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.index - b.index);
  const exploratory = [...candidates]
    .filter((candidate) => candidate.novel)
    .sort((a, b) => a.index - b.index);
  const output = [];
  const used = new Set();

  while (output.length < candidates.length) {
    const explorationSlot = output.length > 0 && (output.length + 1) % 5 === 0;
    const pool = explorationSlot ? exploratory : ranked;
    let next = pool.find((candidate) => !used.has(candidate.index));
    if (!next) next = ranked.find((candidate) => !used.has(candidate.index));
    if (!next) break;
    used.add(next.index);
    output.push(next);
  }

  return output;
}

function getEventSignals(eventName, properties = {}) {
  if (eventName === 'recipe_selection_changed') {
    return [{
      recipe: properties,
      weight: properties.action === 'deselected' ? -1 : properties.action === 'selected' ? 1 : 0
    }];
  }
  if (eventName === 'recipe_saved') return [{ recipe: properties, weight: 3 }];
  if (eventName === 'recipe_unsaved') return [{ recipe: properties, weight: -2 }];
  if (eventName === 'recipe_added_to_calendar' || eventName === 'calendar_meal_added') {
    return [{ recipe: properties, weight: 4 }];
  }
  if (eventName === 'recipe_repeated') return [{ recipe: properties, weight: 0.5 }];
  if (eventName === 'recipe_swapped') {
    return [
      { recipe: properties.from, weight: -1.5 },
      { recipe: properties.to, weight: 1.5 }
    ];
  }
  if (eventName === 'menu_selected') {
    const skippedRecipeNames = Array.isArray(properties.skippedRecipeNames)
      ? properties.skippedRecipeNames
      : [];
    return skippedRecipeNames.slice(0, 80).map((name) => ({
      recipe: { name },
      weight: -0.08,
      exactOnly: true
    }));
  }
  return [];
}

function applyRecipeSignal(profile, recipe = {}, weight, createdAt, { exactOnly = false } = {}) {
  const features = getRecipeFeatures(recipe);
  if (!features.name) return;

  addScore(profile.scores.recipes, features.name, weight);
  if (!exactOnly) {
    addScore(profile.scores.proteins, features.protein, weight);
    addScore(profile.scores.mealTypes, features.mealType, weight * 0.25);
    features.ingredients.forEach((ingredient) => addScore(profile.scores.ingredients, ingredient, weight));
    features.styles.forEach((style) => addScore(profile.scores.styles, style, weight));
  }

  const existing = profile.recentRecipes[features.name] || { score: 0, lastAt: createdAt };
  profile.recentRecipes[features.name] = {
    score: clamp(existing.score + weight, -30, 30),
    lastAt: existing.lastAt > createdAt ? existing.lastAt : createdAt
  };
}

function getRecipeFeatures(recipe = {}) {
  const ingredientTags = Array.isArray(recipe.ingredientTags) ? recipe.ingredientTags : [];
  const styleTags = Array.isArray(recipe.styleTags) ? recipe.styleTags : [];
  const text = [
    recipe.name,
    recipe.description,
    recipe.protein,
    ...(Array.isArray(recipe.ingredients) ? recipe.ingredients : []),
    ...ingredientTags,
    ...styleTags
  ].filter(Boolean).join(' ').toLowerCase();

  return {
    name: normalizeRecipeName(recipe.name),
    mealType: normalizeLabel(recipe.mealType),
    protein: normalizeProtein(recipe.protein || recipe.name || text),
    ingredients: uniqueValues([
      ...ingredientTags,
      ...INGREDIENT_TERMS.filter((term) => text.includes(term))
    ]).slice(0, 12),
    styles: uniqueValues([
      ...styleTags,
      ...Object.entries(STYLE_PATTERNS)
        .filter(([, pattern]) => pattern.test(text))
        .map(([style]) => style)
    ]).slice(0, 6)
  };
}

function getRecommendationReason(features, profile, exactRecipeScore) {
  if (exactRecipeScore < 0) return null;

  const proteinScore = Number(profile.scores.proteins[features.protein] || 0);
  if (features.protein && proteinScore > 1) {
    return `More ${displayLabel(features.protein)} ideas based on your picks`;
  }

  const style = features.styles
    .map((value) => ({ value, score: Number(profile.scores.styles[value] || 0) }))
    .sort((a, b) => b.score - a.score)[0];
  if (style?.score > 1) return `Similar ${displayLabel(style.value)} recipes, with something new`;

  const ingredient = features.ingredients
    .map((value) => ({ value, score: Number(profile.scores.ingredients[value] || 0) }))
    .sort((a, b) => b.score - a.score)[0];
  if (ingredient?.score > 1) return `Inspired by recipes you liked with ${ingredient.value}`;

  return null;
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

  values.push([...SUPPORTED_EVENTS]);
  values.push(MAX_EVENTS);
  const result = await pool.query(
    `select created_at, event_name, properties
     from public.analytics_events
     where (${conditions.join(' or ')})
       and event_name = any($${values.length - 1})
     order by created_at desc
     limit $${values.length}`,
    values
  );
  return result.rows;
}

async function deleteDatabaseEvents(identity) {
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
  await pool.query(`delete from public.analytics_events where ${conditions.join(' or ')}`, values);
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
    .filter((event) => event && eventMatchesIdentity(event, identity))
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

function addScore(scores, key, weight) {
  const normalizedKey = normalizeLabel(key);
  if (!normalizedKey) return;
  scores[normalizedKey] = clamp(Number(scores[normalizedKey] || 0) + weight, -50, 50);
}

function averageFeatureScore(features = [], scores = {}) {
  if (!features.length) return 0;
  const values = features.map((feature) => Number(scores[feature] || 0));
  return values.reduce((total, value) => total + value, 0) / Math.sqrt(values.length);
}

function compactScoreGroups(scores) {
  return Object.fromEntries(
    Object.entries(scores).map(([group, values]) => [
      group,
      Object.fromEntries(
        Object.entries(values)
          .filter(([, score]) => Math.abs(Number(score)) >= 0.05)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, group === 'recipes' ? 160 : 80)
          .map(([key, score]) => [key, Number(Number(score).toFixed(3))])
      )
    ])
  );
}

function compactRecentRecipes(recipes) {
  return Object.fromEntries(
    Object.entries(recipes)
      .sort((a, b) => String(b[1].lastAt).localeCompare(String(a[1].lastAt)))
      .slice(0, 160)
      .map(([key, value]) => [key, {
        score: Number(Number(value.score).toFixed(3)),
        lastAt: value.lastAt
      }])
  );
}

function topPositiveKeys(scores = {}, limit = 3) {
  return Object.entries(scores)
    .filter(([, score]) => Number(score) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, score]) => ({ name, score: Number(Number(score).toFixed(2)) }));
}

function uniqueValues(values = []) {
  return [...new Set(values.map(normalizeLabel).filter(Boolean))];
}

function normalizeProtein(value = '') {
  const text = String(value || '').toLowerCase();
  if (text.includes('chicken')) return 'chicken';
  if (text.includes('turkey')) return 'turkey';
  if (text.includes('pork')) return 'pork';
  if (text.includes('salmon')) return 'salmon';
  if (text.includes('tuna')) return 'tuna';
  if (text.includes('shrimp')) return 'shrimp';
  if (text.includes('beef') || text.includes('steak')) return 'beef';
  if (text.includes('egg')) return 'egg';
  if (text.includes('tofu')) return 'tofu';
  if (text.includes('yogurt')) return 'yogurt';
  if (text.includes('fish') || text.includes('cod') || text.includes('tilapia')) return 'fish';
  return normalizeLabel(value);
}

function normalizeRecipeName(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeLabel(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
}

function displayLabel(value = '') {
  if (value === 'egg') return 'egg';
  return value;
}

function daysSince(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 86_400_000) : Infinity;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
