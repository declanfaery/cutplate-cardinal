import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMealPlan, normalizePreferences } from '../src/recipeEngine.js';
import { buildAssignedMealPlan, estimateGroceryCost } from '../src/costEstimator.js';

test('normalizes unsupported day counts to five days', () => {
  const preferences = normalizePreferences({ days: 4 });

  assert.equal(preferences.days, 5);
});

test('normalizes grocery budget before recipe generation', () => {
  const preferences = normalizePreferences({ groceryBudget: '65' });

  assert.equal(preferences.groceryBudget, 65);
});

test('normalizes calorie target as per-meal per-serving and derives daily totals', () => {
  const preferences = normalizePreferences({
    calorieTarget: '600',
    servingsPerMeal: 2,
    mealSlots: [
      { type: 'Breakfast', time: '8:00 AM' },
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' }
    ]
  });

  assert.equal(preferences.calorieTarget, 600);
  assert.equal(preferences.calorieTargetBasis, 'per_meal_per_serving');
  assert.equal(preferences.dailyCalorieTarget, 1800);
  assert.equal(preferences.cookedDailyCalorieTarget, 3600);
});

test('rejects unrealistically tiny calorie targets', () => {
  const preferences = normalizePreferences({ calorieTarget: '80' });

  assert.equal(preferences.calorieTarget, null);
});

test('builds a complete plan with requested days and meal slots', () => {
  const plan = buildMealPlan({
    days: 3,
    proteins: ['Chicken', 'Salmon'],
    mealSlots: [
      { type: 'Lunch', time: '12:00 PM' },
      { type: 'Dinner', time: '7:00 PM' }
    ],
    sourceHandles: ['@roadtoaesthetics']
  });

  assert.equal(plan.days.length, 3);
  assert.equal(plan.summary.totalMeals, 6);
  assert.equal(plan.days[0].meals.length, 2);
  assert.ok(plan.days[0].meals[0].ingredients.length > 0);
  assert.ok(plan.shoppingList.length > 0);
  assert.ok(plan.groceryEstimate.estimatedTotal > 0);
});

test('builds a large selectable recipe library with varied per-meal calories', () => {
  const plan = buildMealPlan({
    days: 5,
    proteins: ['Chicken', 'Turkey', 'Salmon'],
    mealSlots: [
      { type: 'Breakfast', time: '8:00 AM' },
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' },
      { type: 'Snack', time: '3:30 PM' }
    ],
    calorieTarget: 600,
    servingsPerMeal: 2
  });

  assert.equal(plan.recipeLibrary.length, 48);

  const lunchOptions = plan.recipeLibrary.filter((meal) => meal.mealType === 'Lunch');
  const lunchCalories = new Set(lunchOptions.map((meal) => meal.macros.calories));
  const optionNames = new Set(plan.recipeLibrary.map((meal) => meal.name));

  assert.ok(lunchOptions.length >= 10);
  assert.ok(lunchCalories.size > 4);
  assert.equal(optionNames.size, plan.recipeLibrary.length);
  assert.ok(lunchOptions.every((meal) => meal.macros.calories >= 380 && meal.macros.calories <= 620));
});

test('budget changes the generated recipe library mix', () => {
  const baseInput = {
    days: 3,
    proteins: ['Beef', 'Turkey', 'Salmon'],
    mealSlots: [
      { type: 'Breakfast', time: '8:00 AM' },
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' }
    ],
    calorieTarget: 600,
    servingsPerMeal: 2
  };
  const lowBudgetPlan = buildMealPlan({ ...baseInput, groceryBudget: 45 });
  const highBudgetPlan = buildMealPlan({ ...baseInput, groceryBudget: 180 });

  const lowNames = lowBudgetPlan.recipeLibrary.map((meal) => meal.name).join(' ');
  const highNames = highBudgetPlan.recipeLibrary.map((meal) => meal.name).join(' ');

  assert.match(lowNames, /Lean Ground Beef/);
  assert.match(lowNames, /93% Lean Ground Turkey/);
  assert.match(lowNames, /Canned Tuna/);
  assert.match(highNames, /Sirloin Steak/);
  assert.match(highNames, /Salmon/);
});

test('a high per-meal budget prioritizes premium proteins in the option list', () => {
  const plan = buildMealPlan({
    days: 3,
    proteins: ['Chicken', 'Turkey', 'Salmon', 'Beef', 'Greek yogurt', 'Eggs'],
    mealSlots: [{ type: 'Dinner', time: '6:30 PM' }],
    calorieTarget: 600,
    servingsPerMeal: 2,
    groceryBudget: 50
  });

  const firstDinnerNames = plan.recipeLibrary.slice(0, 4).map((meal) => meal.name).join(' ');

  assert.match(firstDinnerNames, /Sirloin Steak/);
  assert.match(firstDinnerNames, /Salmon/);
});

test('fits selected library recipes into days after menu selection', () => {
  const plan = buildMealPlan({
    days: 3,
    proteins: ['Chicken', 'Turkey'],
    mealSlots: [
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' }
    ],
    servingsPerMeal: 2
  });

  const lunches = plan.recipeLibrary.filter((meal) => meal.mealType === 'Lunch').slice(0, 3);
  const dinners = plan.recipeLibrary.filter((meal) => meal.mealType === 'Dinner').slice(0, 3);
  const assignments = plan.days.flatMap((day, dayIndex) => [
    {
      slotKey: `${day.dayNumber}-Lunch-0`,
      dayNumber: day.dayNumber,
      mealType: 'Lunch',
      time: '12:30 PM',
      meal: lunches[dayIndex]
    },
    {
      slotKey: `${day.dayNumber}-Dinner-1`,
      dayNumber: day.dayNumber,
      mealType: 'Dinner',
      time: '6:30 PM',
      meal: dinners[dayIndex]
    }
  ]);

  const assignedPlan = buildAssignedMealPlan(plan, assignments);

  assert.equal(assignedPlan.days.length, 3);
  assert.equal(assignedPlan.summary.totalMeals, 6);
  assert.equal(assignedPlan.days[0].meals[0].name, lunches[0].name);
  assert.equal(assignedPlan.days[2].meals[1].name, dinners[2].name);
});

test('grocery estimate uses shopping units instead of generic servings', () => {
  const plan = buildMealPlan({
    days: 3,
    proteins: ['Chicken', 'Salmon'],
    mealSlots: [
      { type: 'Lunch', time: '12:30 PM' },
      { type: 'Dinner', time: '6:30 PM' }
    ],
    servingsPerMeal: 2
  });

  const salmon = plan.groceryEstimate.lineItems.find((item) => item.name === 'Salmon fillets');
  const chicken = plan.groceryEstimate.lineItems.find((item) => item.name === 'Chicken breasts');
  const broccoli = plan.groceryEstimate.lineItems.find((item) => item.name === 'Broccoli');
  const seasoningBucket = plan.groceryEstimate.lineItems.find((item) => item.name === 'Seasonings and sauces');

  assert.match(salmon.quantityLabel, /fillets/);
  assert.match(chicken.quantityLabel, /breasts/);
  assert.match(broccoli.quantityLabel, /cups/);
  assert.equal(seasoningBucket, undefined);
  assert.doesNotMatch(salmon.quantityLabel, /servings/);
});

test('shopping list breaks seasonings and sauces into teaspoon and tablespoon measurements', () => {
  const estimate = estimateGroceryCost(
    {
      preferences: { servingsPerMeal: 2 },
      days: [
        {
          meals: [
            {
              ingredients: [
                '1 serving 93% lean ground turkey',
                '1 tbsp lime juice',
                '1/2 tsp chili powder',
                '1/4 tsp kosher salt',
                '1/4 tsp black pepper',
                '1 tbsp Greek yogurt sauce'
              ]
            }
          ]
        }
      ]
    },
    { servingsPerMeal: 2 }
  );

  const turkey = estimate.lineItems.find((item) => item.name === '93% lean ground turkey');
  const lime = estimate.lineItems.find((item) => item.name === 'Limes');
  const chili = estimate.lineItems.find((item) => item.name === 'Chili powder');
  const yogurtSauce = estimate.lineItems.find((item) => item.name === 'Greek yogurt sauce');

  assert.match(turkey.quantityLabel, /1 pack \(1 lb; need ~12 oz\)/);
  assert.match(lime.quantityLabel, /1 lime .*need 2 tbsp/);
  assert.match(chili.quantityLabel, /1 jar .*need 1 tsp/);
  assert.match(yogurtSauce.quantityLabel, /1 tub .*need 2 tbsp/);
});

test('explicit meat ounces are not multiplied into impossible fillet counts', () => {
  const estimate = estimateGroceryCost(
    {
      preferences: { servingsPerMeal: 2 },
      days: [
        {
          meals: [
            {
              ingredients: ['16 oz salmon', '12 oz chicken breast', '2 cups broccoli']
            }
          ]
        }
      ]
    },
    { servingsPerMeal: 2 }
  );

  const salmon = estimate.lineItems.find((item) => item.name === 'Salmon fillets');
  const chicken = estimate.lineItems.find((item) => item.name === 'Chicken breasts');

  assert.equal(salmon.quantityLabel, '1 pack (~1 lb, 2-3 fillets; need ~1 lb)');
  assert.equal(chicken.quantityLabel, '1 tray (~1.5 lb, 3-4 breasts; need ~12 oz)');
});
