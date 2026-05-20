import assert from 'node:assert/strict';
import test from 'node:test';

import { attachGroceryEstimate } from '../src/costEstimator.js';

function samplePlan(location) {
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
            name: 'Salmon Rice Bowl',
            ingredients: ['6 oz salmon', '1 cup cooked rice', '1 cup broccoli'],
            macros: {
              calories: 600,
              protein: 42,
              carbs: 55,
              fat: 20
            }
          }
        ]
      }
    ],
    summary: {}
  };
}

test('grocery estimate uses UK currency and region for UK locations', () => {
  const plan = attachGroceryEstimate(samplePlan('London UK'));

  assert.equal(plan.groceryEstimate.region, 'uk');
  assert.equal(plan.groceryEstimate.currency, 'GBP');
  assert.equal(plan.groceryEstimate.currencySymbol, '\u00a3');
  assert.match(plan.groceryEstimate.note, /UK average estimate/);
});

test('grocery estimate uses Canadian currency and region for Canadian postal codes', () => {
  const plan = attachGroceryEstimate(samplePlan('M5V 2T6'));

  assert.equal(plan.groceryEstimate.region, 'canada');
  assert.equal(plan.groceryEstimate.currency, 'CAD');
  assert.equal(plan.groceryEstimate.currencySymbol, 'C$');
  assert.match(plan.groceryEstimate.note, /Canada average estimate/);
});

test('grocery estimate uses euro pricing for EU locations', () => {
  const plan = attachGroceryEstimate(samplePlan('Berlin Germany'));

  assert.equal(plan.groceryEstimate.region, 'eu');
  assert.equal(plan.groceryEstimate.currency, 'EUR');
  assert.equal(plan.groceryEstimate.currencySymbol, '\u20ac');
  assert.match(plan.groceryEstimate.note, /EU average estimate/);
});
