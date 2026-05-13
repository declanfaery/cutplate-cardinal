import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCookableRecipeSteps, normalizeGeneratedRecipe } from '../src/openaiPlanner.js';

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

test('normalizes repeated generated step numbers', () => {
  const recipe = normalizeGeneratedRecipe(
    {
      id: 'numbered-steps',
      mealType: 'Dinner',
      time: '6:30 PM',
      name: 'Chicken Skillet',
      protein: 'Chicken',
      description: 'Chicken skillet.',
      macroRating: 'FIT',
      prepTime: '30 minutes',
      macros: { calories: 520, protein: 44, carbs: 48, fat: 14 },
      ingredients: ['1 lb chicken breast'],
      steps: ['1. 1. Preheat oven to 400 F and line a sheet pan.'],
      sources: [],
      sourceSearches: []
    },
    0,
    'Dinner'
  );

  assert.deepEqual(recipe.steps, ['Preheat oven to 400 F and line a sheet pan.']);
});

test('rejects vague generated recipe step summaries', () => {
  assert.equal(hasCookableRecipeSteps({
    steps: [
      'Saute garlic; add chicken until cooked.',
      'Stir in cream and Parmesan; add greens and tomatoes.',
      'Serve over couscous.'
    ]
  }), false);

  assert.equal(hasCookableRecipeSteps({
    steps: [
      'Pat the chicken dry, slice thinly, and season both sides with kosher salt, black pepper, Italian seasoning, and smoked paprika.',
      'Heat olive oil in a large skillet over medium-high heat until shimmering.',
      'Add the chicken in a single layer and sear for 3-4 minutes per side until browned and it reaches 165 F.',
      'Move the chicken to a plate, reduce heat to medium, and saute garlic for 30 seconds until fragrant.',
      'Pour in broth, scrape up browned bits, and simmer for 2-3 minutes until slightly reduced.',
      'Whisk in Greek yogurt off heat so the sauce stays smooth, then return chicken and spinach to the skillet.',
      'Simmer 1-2 minutes until spinach wilts, taste for seasoning, and serve over cooked couscous.'
    ]
  }), true);
});
