import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPantryLearningGuidance,
  buildPantryLearningProfile,
  buildPantryScanFeedback,
  getPantryLearningSummary
} from '../src/pantryLearning.js';

test('builds structured pantry corrections from detected and reviewed items', () => {
  const feedback = buildPantryScanFeedback({
    mealType: 'Dinner',
    detectedIngredients: [
      { name: 'Apple', confidence: 'high' },
      { name: 'Rice', confidence: 'high' },
      { name: 'Tuna', confidence: 'medium' }
    ],
    finalIngredients: 'rice, canned tuna, eggs'
  });

  assert.deepEqual(feedback.confirmedItems, ['rice', 'tuna']);
  assert.deepEqual(feedback.addedItems, ['eggs']);
  assert.deepEqual(feedback.removedItems, ['apple']);
  assert.equal(feedback.confirmedCount, 2);
  assert.equal(feedback.userAddedCount, 1);
  assert.equal(feedback.removedCount, 1);
  assert.equal(feedback.correctionRatePct, 66.7);
});

test('learns account-specific missed and repeatedly removed pantry labels', () => {
  const profile = buildPantryLearningProfile([
    event({
      confirmedItems: ['rice', 'milk'],
      addedItems: ['greek yogurt'],
      removedItems: ['protein pasta']
    }),
    event({
      confirmedItems: ['rice'],
      addedItems: ['greek yogurt', 'eggs'],
      removedItems: ['protein pasta', 'milk']
    })
  ], {
    userId: 'user-1',
    email: 'cook@example.com'
  });

  assert.equal(profile.correctionCount, 2);
  assert.deepEqual(profile.frequentlyAdded[0], { name: 'greek yogurt', count: 2 });
  assert.deepEqual(profile.frequentlyRemoved, [
    { name: 'protein pasta', count: 2, confirmedCount: 0 }
  ]);
  assert.deepEqual(getPantryLearningSummary(profile), {
    active: true,
    correctionCount: 2,
    frequentlyAddedCount: 2,
    frequentlyRemovedCount: 1,
    updatedAt: '2026-07-02T12:00:00.000Z'
  });

  const guidance = buildPantryLearningGuidance(profile);
  assert.match(guidance, /greek yogurt/);
  assert.match(guidance, /protein pasta/);
  assert.match(guidance, /only when visible/i);
  assert.match(guidance, /only when clearly visible/i);
});

test('ignores old aggregate-only pantry events for learning', () => {
  const profile = buildPantryLearningProfile([
    event({
      detectedCount: 8,
      confirmedCount: 7,
      userAddedCount: 1,
      removedCount: 1
    })
  ], { userId: 'user-1' });

  assert.equal(profile, null);
  assert.deepEqual(getPantryLearningSummary(profile), {
    active: false,
    correctionCount: 0
  });
});

function event(properties) {
  return {
    eventName: 'pantry_scan_confirmed',
    createdAt: '2026-07-02T12:00:00.000Z',
    properties
  };
}
