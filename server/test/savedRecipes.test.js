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
  assert.ok(hotPocket.ingredients.includes('500 g plain nonfat Greek yogurt, plus 20 g more if the dough is dry'));
  assert.ok(koreanChicken.ingredients.includes('1 tbsp honey'));
  assert.ok(koreanChicken.ingredients.includes('2 tsp minced garlic'));
  assert.ok(koreanChicken.ingredients.includes('1 tbsp grated ginger'));
  assert.ok(hotPocket.steps.every((step) => !/\b\d{2,3}\s*C\b/i.test(step)));
});

test('saved repeat recipes can scale grocery quantities across selected days', () => {
  const preferences = normalizePreferences({
    days: 10,
    proteins: ['Chicken'],
    mealSlots: [{ type: 'Dinner', time: '6:30 PM' }],
    servingsPerMeal: 2,
    recipeVarietyMode: 'same'
  });
  const plan = buildSavedRecipePlan(preferences);
  const hotPocket = plan.recipeLibrary.find((recipe) => recipe.name === 'Buffalo Chicken Hot Pockets');
  const assignments = Array.from({ length: 10 }, (_, index) => ({
    slotKey: `${index + 1}-Dinner-0`,
    dayNumber: index + 1,
    mealType: 'Dinner',
    time: '6:30 PM',
    meal: hotPocket
  }));

  const assigned = attachGroceryEstimate(buildAssignedMealPlan(plan, assignments), preferences);
  const flour = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Flour and baking mix');
  const buffalo = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Buffalo sauce');

  assert.equal(assigned.summary.totalMeals, 10);
  assert.ok(flour?.quantityLabel);
  assert.ok(buffalo?.quantityLabel);
});
