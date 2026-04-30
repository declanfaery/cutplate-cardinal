import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildPlanCacheKey,
  getCachedPlan,
  listCachedRecipes,
  setCachedPlan
} from '../src/planCache.js';
import { normalizePreferences } from '../src/recipeEngine.js';

test('plan cache stores and restores a plan response for matching choices', async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'cutplate-cache-'));
  const originalCacheDir = process.env.PLAN_CACHE_DIR;
  process.env.PLAN_CACHE_DIR = cacheDir;

  try {
    const preferences = normalizePreferences({
      days: 3,
      proteins: ['Turkey', 'Chicken'],
      mealSlots: [{ type: 'Lunch', time: '12:30 PM' }],
      groceryBudget: 75
    });
    const response = {
      mode: 'local',
      warnings: [],
      plan: {
        id: 'test-plan',
        preferences,
        days: [],
        summary: { totalMeals: 0 }
      }
    };

    assert.equal(await getCachedPlan(preferences), null);

    await setCachedPlan(preferences, response);
    const cached = await getCachedPlan(preferences);

    assert.equal(cached.cache.hit, true);
    assert.equal(cached.mode, 'local');
    assert.equal(cached.plan.id, 'test-plan');
    assert.deepEqual(cached.plan.preferences.proteins, ['Turkey', 'Chicken']);
  } finally {
    if (originalCacheDir === undefined) {
      delete process.env.PLAN_CACHE_DIR;
    } else {
      process.env.PLAN_CACHE_DIR = originalCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('plan cache lists pantry-matching cached recipes', async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'cutplate-cache-'));
  const originalCacheDir = process.env.PLAN_CACHE_DIR;
  process.env.PLAN_CACHE_DIR = cacheDir;

  try {
    const preferences = normalizePreferences({
      days: 3,
      proteins: ['Chicken'],
      mealSlots: [{ type: 'Dinner', time: '6:30 PM' }]
    });
    const response = {
      mode: 'ai',
      warnings: [],
      plan: {
        id: 'cached-plan',
        preferences,
        days: [],
        summary: { totalMeals: 0 },
        recipeLibrary: [
          {
            id: 'rice-bowl',
            mealType: 'Dinner',
            time: '6:30 PM',
            name: 'Chicken Rice Bowl',
            protein: 'Chicken',
            description: 'A bowl with rice and broccoli.',
            macros: { calories: 520, protein: 42, carbs: 48, fat: 12 },
            ingredients: ['1 serving chicken breast', '1 cup rice', '1 cup broccoli'],
            steps: []
          },
          {
            id: 'salad',
            mealType: 'Dinner',
            time: '6:30 PM',
            name: 'Chicken Salad',
            protein: 'Chicken',
            description: 'A greens-heavy plate.',
            macros: { calories: 430, protein: 40, carbs: 18, fat: 14 },
            ingredients: ['1 serving chicken breast', '2 cups romaine'],
            steps: []
          }
        ]
      }
    };

    await setCachedPlan(preferences, response);
    const recipes = await listCachedRecipes({ ingredients: ['rice'], limit: 10 });

    assert.equal(recipes.length, 1);
    assert.equal(recipes[0].name, 'Chicken Rice Bowl');
    assert.equal(recipes[0].cached, true);
  } finally {
    if (originalCacheDir === undefined) {
      delete process.env.PLAN_CACHE_DIR;
    } else {
      process.env.PLAN_CACHE_DIR = originalCacheDir;
    }
    await rm(cacheDir, { recursive: true, force: true });
  }
});

test('plan cache key reuses nearby budgets in the same budget tier', () => {
  const base = {
    days: 3,
    proteins: ['Chicken', 'Turkey'],
    mealSlots: [
      { type: 'Breakfast', time: '8:00 AM' },
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' }
    ],
    servingsPerMeal: 2,
    calorieTarget: 1800
  };

  const standardA = normalizePreferences({ ...base, groceryBudget: 75 });
  const standardB = normalizePreferences({ ...base, groceryBudget: 80 });
  const highBudget = normalizePreferences({ ...base, groceryBudget: 160 });

  assert.equal(buildPlanCacheKey(standardA), buildPlanCacheKey(standardB));
  assert.notEqual(buildPlanCacheKey(standardA), buildPlanCacheKey(highBudget));
});
