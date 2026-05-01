import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPantryRecipes } from '../src/pantryRecipes.js';

test('builds pantry recipes only from entered pantry ingredients plus small measured flavor additions', () => {
  const response = buildPantryRecipes({
    ingredients: 'chicken breast, rice, broccoli, salsa',
    mealType: 'Dinner'
  });

  assert.ok(response.recipes.length >= 4);
  assert.equal(response.recipes[0].mealType, 'Dinner');
  assert.ok(response.recipes[0].ingredients.some((ingredient) => /chicken breast/i.test(ingredient)));
  assert.ok(response.recipes[0].ingredients.some((ingredient) => /rice|broccoli|salsa/i.test(ingredient)));
  assert.ok(response.recipes.every((recipe) => recipe.pantryUsed.length > 0));
  assert.ok(response.recipes.every((recipe) => recipe.smallAdds.every((ingredient) => /\b(tbsp|tsp)\b/i.test(ingredient))));
});

test('requires pantry ingredients before returning recipes', () => {
  assert.throws(() => buildPantryRecipes({ ingredients: '', mealType: 'Lunch' }), /Enter pantry/);
});
