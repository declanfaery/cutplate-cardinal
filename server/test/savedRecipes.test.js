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

test('saved repeat recipes can scale grocery quantities across selected days', () => {
  const preferences = normalizePreferences({
    days: 5,
    proteins: ['Chicken'],
    mealSlots: [{ type: 'Dinner', time: '6:30 PM' }],
    servingsPerMeal: 2,
    recipeVarietyMode: 'same'
  });
  const plan = buildSavedRecipePlan(preferences);
  const hotPocket = plan.recipeLibrary.find((recipe) => recipe.name === 'Buffalo Chicken Hot Pockets');
  const assignments = Array.from({ length: 5 }, (_, index) => ({
    slotKey: `${index + 1}-Dinner-0`,
    dayNumber: index + 1,
    mealType: 'Dinner',
    time: '6:30 PM',
    meal: hotPocket
  }));

  const assigned = attachGroceryEstimate(buildAssignedMealPlan(plan, assignments), preferences);
  const flour = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Flour and baking mix');
  const chicken = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Chicken breasts');
  const yogurt = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Greek yogurt');
  const chives = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Fresh chives');
  const buffalo = assigned.groceryEstimate.lineItems.find((item) => item.name === 'Buffalo sauce');

  assert.equal(assigned.summary.totalMeals, 5);
  assert.match(chicken?.quantityLabel || '', /need ~2\.5 lb/);
  assert.match(flour?.quantityLabel || '', /need 4 cups/);
  assert.match(yogurt?.quantityLabel || '', /need 2\.1 cups/);
  assert.match(chives?.quantityLabel || '', /need 10 g/);
  assert.ok(buffalo?.quantityLabel);
  assert.ok(assigned.groceryEstimate.estimatedTotal < 100);
});
