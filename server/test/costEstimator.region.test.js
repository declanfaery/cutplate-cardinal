import assert from 'node:assert/strict';
import test from 'node:test';

import { attachGroceryEstimate } from '../src/costEstimator.js';

function chickenThighPlan(location, chickenIngredient) {
  return {
    preferences: {
      servingsPerMeal: 2,
      location
    },
    days: [
      {
        dayNumber: 1,
        meals: [
          {
            id: 'dinner-1',
            mealType: 'Dinner',
            time: '6:30 PM',
            name: 'Sheet Pan Chicken',
            ingredients: [chickenIngredient, '1 tbsp olive oil', '1 cup green vegetables'],
            macros: {
              calories: 600,
              protein: 44,
              carbs: 30,
              fat: 18
            }
          }
        ]
      }
    ],
    summary: {}
  };
}

test('regional estimates keep explicit chicken-thigh counts sane across UK, Canada, and US', () => {
  for (const location of ['London UK', 'Toronto Canada', '10001']) {
    const plan = attachGroceryEstimate(chickenThighPlan(location, '4 chicken thighs'));
    const chicken = plan.groceryEstimate.lineItems.find((item) => item.name === 'Chicken thighs');

    assert.ok(chicken, `${location} should include chicken thighs`);
    assert.equal(chicken.costUnits, 20);
    assert.equal(chicken.purchaseQuantity, 1);
    assert.match(chicken.quantityLabel, /1 tray .*need ~1\.3 lb/);
  }
});

test('implausible non-batch chicken weights are capped before regional pricing', () => {
  const plan = attachGroceryEstimate(chickenThighPlan('London UK', '21 lb chicken thighs'));
  const chicken = plan.groceryEstimate.lineItems.find((item) => item.name === 'Chicken thighs');

  assert.ok(chicken);
  assert.equal(chicken.costUnits, 20);
  assert.equal(chicken.purchaseQuantity, 1);
  assert.match(chicken.quantityLabel, /need ~1\.3 lb/);
  assert.ok(chicken.estimatedCost < 15, `expected sane UK chicken estimate, got ${chicken.estimatedCost}`);
});
