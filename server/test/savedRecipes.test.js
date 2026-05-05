import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSavedRecipePlan, getSavedRecipesForPreferences } from '../src/savedRecipes.js';
import { normalizePreferences } from '../src/recipeEngine.js';
import { attachGroceryEstimate, buildAssignedMealPlan } from '../src/costEstimator.js';

test('saved repeat recipe library includes proofread measured recipe ingredients', () => {
  const preferences = normalizePreferences({
    days: 10,
    proteins: ['Chicken'],
    mealSlots: [{ type: 'Dinner', time: '6:30 PM' }],
    recipeVarietyMode: 'same'
  });

  const recipes = getSavedRecipesForPreferences(preferences);
  const hotPocket = recipes.find((recipe) => recipe.name === 'Buffalo Chicken Hot Pockets');
  const koreanChicken = recipes.find((recipe) => recipe.name === 'Korean Fried Chicken Sandwich');

  assert.ok(hotPocket);
  assert.ok(koreanChicken);
  assert.equal(hotPocket.baseServings, 10);
  assert.equal(hotPocket.ingredientScale, 'batch');
  assert.ok(hotPocket.ingredients.includes('520 g plain nonfat Greek yogurt'));
  assert.ok(koreanChicken.ingredients.includes('1 tbsp honey'));
  assert.ok(koreanChicken.ingredients.includes('2 tsp minced garlic'));
  assert.ok(koreanChicken.ingredients.includes('1 tbsp grated ginger'));
  assert.ok(hotPocket.steps.every((step) => !/\b\d{2,3}\s*C\b/i.test(step)));
});

test('saved repeat recipes scale grocery quantities from selected days and servings', () => {
  const cases = [
    {
      days: 3,
      servingsPerMeal: 1,
      expected: { chickenOz: 12, flourCups: 1.2, yogurtCups: 0.6, chivesG: 3 }
    },
    {
      days: 5,
      servingsPerMeal: 2,
      expected: { chickenOz: 40, flourCups: 4, yogurtCups: 2.1, chivesG: 10 }
    },
    {
      days: 10,
      servingsPerMeal: 2,
      expected: { chickenOz: 80, flourCups: 8, yogurtCups: 4.2, chivesG: 20 }
    }
  ];

  for (const testCase of cases) {
    const preferences = normalizePreferences({
      days: testCase.days,
      proteins: ['Chicken'],
      mealSlots: [{ type: 'Dinner', time: '6:30 PM' }],
      servingsPerMeal: testCase.servingsPerMeal,
      recipeVarietyMode: 'same'
    });
    const plan = buildSavedRecipePlan(preferences);
    const hotPocket = plan.recipeLibrary.find((recipe) => recipe.name === 'Buffalo Chicken Hot Pockets');
    const assignments = Array.from({ length: testCase.days }, (_, index) => ({
      slotKey: `${index + 1}-Dinner-0`,
      dayNumber: index + 1,
      mealType: 'Dinner',
      time: '6:30 PM',
      meal: hotPocket
    }));

    const assigned = attachGroceryEstimate(buildAssignedMealPlan(plan, assignments), preferences);
    const lineItemByName = new Map(assigned.groceryEstimate.lineItems.map((item) => [item.name, item]));
    const context = `${testCase.days} days x ${testCase.servingsPerMeal} servings`;

    assert.equal(assigned.summary.totalMeals, testCase.days, context);
    assertAlmostEqual(lineItemByName.get('Chicken breasts')?.costUnits, testCase.expected.chickenOz, context);
    assertAlmostEqual(lineItemByName.get('Flour and baking mix')?.costUnits, testCase.expected.flourCups, context);
    assertAlmostEqual(lineItemByName.get('Greek yogurt')?.costUnits, testCase.expected.yogurtCups, context);
    assertAlmostEqual(lineItemByName.get('Fresh chives')?.costUnits, testCase.expected.chivesG, context);
  }
});

function assertAlmostEqual(actual, expected, context) {
  assert.ok(Number.isFinite(actual), `${context}: expected a numeric amount`);
  assert.ok(Math.abs(actual - expected) <= 0.11, `${context}: expected ${actual} to be close to ${expected}`);
}
