import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLearnedPriceAdjustment,
  recordGroceryPriceFeedback,
  resetPriceLearningForTests
} from '../src/priceLearning.js';

test('deduplicates grocery feedback by feedback id', async () => {
  resetPriceLearningForTests();
  const first = await recordGroceryPriceFeedback(sample({
    feedbackId: 'same-plan',
    userId: 'shopper-1',
    actualTotal: 120
  }), { persist: false });
  const updated = await recordGroceryPriceFeedback(sample({
    feedbackId: 'same-plan',
    userId: 'shopper-1',
    actualTotal: 125
  }), { persist: false });
  const adjustment = getLearnedPriceAdjustment({
    market: 'canada',
    currency: 'CAD',
    storeName: 'Price Chopper'
  });

  assert.equal(first.created, true);
  assert.equal(updated.created, false);
  assert.equal(updated.duplicate, true);
  assert.equal(adjustment.samples, 1);
  assert.equal(adjustment.applied, false);
});

test('waits for independent observations before applying a correction', async () => {
  resetPriceLearningForTests();
  await recordGroceryPriceFeedback(sample({
    feedbackId: 'plan-1',
    userId: 'shopper-1',
    actualTotal: 120
  }), { persist: false });
  await recordGroceryPriceFeedback(sample({
    feedbackId: 'plan-2',
    userId: 'shopper-2',
    actualTotal: 125
  }), { persist: false });

  let adjustment = getLearnedPriceAdjustment({
    market: 'canada',
    currency: 'CAD',
    storeName: 'Price Chopper'
  });
  assert.equal(adjustment.applied, false);

  await recordGroceryPriceFeedback(sample({
    feedbackId: 'plan-3',
    userId: 'shopper-1',
    actualTotal: 118
  }), { persist: false });
  adjustment = getLearnedPriceAdjustment({
    market: 'canada',
    currency: 'CAD',
    storeName: 'Price Chopper'
  });

  assert.equal(adjustment.applied, true);
  assert.equal(adjustment.source, 'store');
  assert.equal(adjustment.samples, 3);
  assert.equal(adjustment.distinctIdentities, 2);
  assert.ok(adjustment.multiplier > 1);
  assert.ok(adjustment.multiplier < 1.2);
});

test('derives price direction from numeric totals instead of trusting a contradictory rating', async () => {
  resetPriceLearningForTests();
  const result = await recordGroceryPriceFeedback(sample({
    feedbackId: 'contradictory-rating',
    userId: 'shopper-1',
    rating: 'too_high',
    actualTotal: 125
  }), { persist: false });

  assert.equal(result.userRating, 'too_high');
  assert.equal(result.derivedRating, 'too_low');
});

function sample(overrides = {}) {
  return {
    feedbackId: 'feedback-1',
    userId: 'shopper-1',
    planId: 'plan-1',
    estimatedTotal: 100,
    actualTotal: 120,
    coarseMarket: 'canada',
    currency: 'CAD',
    storeName: 'Price Chopper',
    rating: 'too_low',
    estimatedLineItems: [
      {
        name: 'Salmon',
        unit: 'oz',
        quantity: 12,
        estimatedCost: 18
      }
    ],
    ...overrides
  };
}
