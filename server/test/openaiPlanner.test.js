import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratedRecipe } from '../src/openaiPlanner.js';

test('normalizes bare generated seasonings into measured ingredients', () => {
  const recipe = normalizeGeneratedRecipe(
    {
      id: 'seasoned-chicken',
      mealType: 'Dinner',
      time: '6:30 PM',
      name: 'Tomato Chicken',
      protein: 'Chicken',
      description: 'Chicken with tomato sauce.',
      macroRating: 'FIT',
      prepTime: '30 minutes',
      macros: { calories: 520, protein: 44, carbs: 48, fat: 14 },
      ingredients: [
        '1 lb chicken breast',
        'salt',
        'pepper',
        'parsley',
        'salt and pepper to taste'
      ],
      steps: [],
      sources: [],
      sourceSearches: []
    },
    0,
    'Dinner'
  );

  assert.deepEqual(recipe.ingredients, [
    '1 lb chicken breast',
    '1/4 tsp kosher salt',
    '1/4 tsp black pepper',
    '1 tsp dried parsley'
  ]);
});
