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
