import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecipePreferenceProfile,
  getPreferenceLearningSummary,
  personalizeRecipeLibrary
} from '../src/preferenceLearning.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

test('builds an account taste profile from weighted recipe actions', () => {
  const profile = buildRecipePreferenceProfile([
    event('recipe_selection_changed', {
      action: 'selected',
      name: 'Salmon Rice Bowl',
      mealType: 'Dinner',
      protein: 'salmon',
      ingredientTags: ['rice', 'cucumber'],
      styleTags: ['bowl']
    }),
    event('recipe_saved', {
      name: 'Salmon Kebab Plate',
      mealType: 'Dinner',
      protein: 'salmon',
      ingredientTags: ['bell pepper'],
      styleTags: ['kebab']
    }),
    event('recipe_selection_changed', {
      action: 'deselected',
      name: 'Beef Skillet',
      mealType: 'Dinner',
      protein: 'beef',
      styleTags: ['skillet']
    })
  ], { userId: 'user-1' }, NOW);

  assert.equal(profile.signalCount, 3);
  assert.ok(profile.scores.proteins.salmon > 0);
  assert.ok(profile.scores.proteins.beef < 0);
  assert.ok(profile.scores.styles.kebab > profile.scores.styles.bowl);
  assert.deepEqual(getPreferenceLearningSummary(profile).topProteins[0].name, 'salmon');
});

test('promotes similar new recipes while penalizing exact repeats and dislikes', () => {
  const profile = buildRecipePreferenceProfile([
    event('recipe_saved', {
      name: 'Salmon Kebab Plate',
      mealType: 'Dinner',
      protein: 'salmon',
      ingredientTags: ['bell pepper', 'rice'],
      styleTags: ['kebab']
    }),
    event('recipe_selection_changed', {
      action: 'deselected',
      name: 'Beef Skillet',
      mealType: 'Dinner',
      protein: 'beef',
      styleTags: ['skillet']
    })
  ], { userId: 'user-1' }, NOW);
  const ranked = personalizeRecipeLibrary([
    recipe('Beef Skillet', 'beef', ['skillet']),
    recipe('Chicken Wrap', 'chicken', ['wrap']),
    recipe('Salmon Kebab Plate', 'salmon', ['kebab']),
    recipe('Salmon Taco Plate', 'salmon', ['taco'])
  ], profile);

  assert.equal(ranked[0].name, 'Salmon Taco Plate');
  assert.match(ranked[0].recommendationReason, /salmon/i);
  assert.ok(
    ranked.findIndex((item) => item.name === 'Salmon Kebab Plate')
      > ranked.findIndex((item) => item.name === 'Salmon Taco Plate')
  );
  assert.ok(
    ranked.findIndex((item) => item.name === 'Beef Skillet')
      > ranked.findIndex((item) => item.name === 'Chicken Wrap')
  );
});

test('allows exact favorites to rank normally in explicit repeat mode', () => {
  const profile = buildRecipePreferenceProfile([
    event('recipe_saved', {
      name: 'Salmon Kebab Plate',
      mealType: 'Dinner',
      protein: 'salmon',
      styleTags: ['kebab']
    })
  ], { userId: 'user-1' }, NOW);
  const ranked = personalizeRecipeLibrary([
    recipe('Chicken Wrap', 'chicken', ['wrap']),
    recipe('Salmon Kebab Plate', 'salmon', ['kebab'])
  ], profile, { allowExactRepeats: true });

  assert.equal(ranked[0].name, 'Salmon Kebab Plate');
});

test('treats unchosen menu options as weak exact skips, not broad ingredient dislikes', () => {
  const profile = buildRecipePreferenceProfile([
    event('menu_selected', {
      skippedRecipeNames: ['Beef Skillet', 'Beef Taco Bake']
    })
  ], { userId: 'user-1' }, NOW);

  assert.ok(profile.scores.recipes['beef skillet'] < 0);
  assert.equal(profile.scores.proteins.beef, undefined);
  assert.equal(profile.scores.styles.skillet, undefined);
});

function event(eventName, properties) {
  return {
    eventName,
    createdAt: '2026-06-28T12:00:00.000Z',
    properties
  };
}

function recipe(name, protein, styleTags) {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    mealType: 'Dinner',
    name,
    protein,
    description: `${name} recipe`,
    ingredients: [],
    styleTags,
    macros: {
      calories: 550,
      protein: 40,
      carbs: 45,
      fat: 18
    }
  };
}
