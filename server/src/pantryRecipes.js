const MEAL_FORMATS = {
  Breakfast: ['Pantry Breakfast Bowl', 'Quick Morning Skillet', 'Protein Breakfast Plate'],
  Lunch: ['Pantry Power Bowl', 'Chopped Pantry Plate', 'Macro Lunch Bowl'],
  Dinner: ['Pantry Dinner Plate', 'One-Pan Pantry Skillet', 'Simple Macro Bowl'],
  Snack: ['Protein Snack Box', 'Pantry Snack Plate', 'Mini Recovery Bowl']
};

const FLAVOR_SETS = [
  {
    label: 'Lime Chili',
    smallAdds: ['1 tbsp lime juice', '1/2 tsp chili powder', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    finish: 'Finish with lime juice, chili powder, salt, and pepper.'
  },
  {
    label: 'Garlic Herb',
    smallAdds: ['1 tbsp lemon juice', '1/2 tsp garlic powder', '1 tsp dried parsley', '1/4 tsp black pepper'],
    finish: 'Finish with lemon juice, garlic powder, dried parsley, and black pepper.'
  },
  {
    label: 'Smoky',
    smallAdds: ['1 tsp smoked paprika', '1/2 tsp garlic powder', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    finish: 'Finish with smoked paprika, garlic powder, salt, and pepper.'
  },
  {
    label: 'Hot Sauce',
    smallAdds: ['1 tbsp hot sauce', '1/4 tsp garlic powder', '1/4 tsp black pepper'],
    finish: 'Finish with hot sauce, garlic powder, and black pepper.'
  },
  {
    label: 'Cinnamon',
    smallAdds: ['1/2 tsp cinnamon', '1 tsp honey or sugar-free syrup optional'],
    finish: 'Finish with cinnamon and a small drizzle of honey or sugar-free syrup if desired.'
  }
];

const TYPE_LIMITS = {
  Breakfast: { calories: [280, 560], protein: [18, 50], carbs: [8, 70], fat: [4, 24] },
  Lunch: { calories: [340, 650], protein: [20, 60], carbs: [12, 78], fat: [5, 28] },
  Dinner: { calories: [360, 720], protein: [24, 66], carbs: [12, 82], fat: [6, 32] },
  Snack: { calories: [130, 340], protein: [8, 34], carbs: [4, 42], fat: [1, 16] }
};

export function buildPantryRecipes(input = {}) {
  const ingredients = parseIngredients(input.ingredients || input.pantryIngredients);
  const mealType = normalizeMealType(input.mealType);

  if (!ingredients.length) {
    const error = new Error('Enter pantry or fridge ingredients first.');
    error.status = 400;
    throw error;
  }

  const pantryItems = ingredients.map(classifyIngredient);
  const anchorItems = pantryItems.filter((item) => item.kind === 'protein');
  const mainItems = anchorItems.length ? anchorItems : pantryItems.slice(0, 2);
  const count = Math.min(8, Math.max(4, pantryItems.length + 2));
  const recipes = Array.from({ length: count }, (_, index) =>
    buildPantryRecipe({ pantryItems, mainItems, mealType, index })
  );

  return {
    recipes,
    usedIngredients: ingredients,
    note: 'Recipes use your pantry entries as the core ingredients plus small measured seasonings, sauces, citrus, or spices.'
  };
}

function buildPantryRecipe({ pantryItems, mainItems, mealType, index }) {
  const main = mainItems[index % mainItems.length];
  const flavor = chooseFlavor(mealType, index);
  const formats = MEAL_FORMATS[mealType] || MEAL_FORMATS.Dinner;
  const format = formats[index % formats.length];
  const selectedPantry = choosePantryItems(pantryItems, main, mealType, index);
  const measuredPantry = selectedPantry.map((item) => item.measurement);
  const macros = estimateMacros(selectedPantry, flavor.smallAdds, mealType);
  const pantryNames = selectedPantry.map((item) => item.label);

  return {
    id: `pantry-${mealType.toLowerCase()}-${index + 1}`,
    optionKey: `pantry-${mealType.toLowerCase()}-${index + 1}`,
    mealType,
    time: defaultTime(mealType),
    name: `${flavor.label} ${main.label} ${format}`,
    protein: main.label,
    description: `Built around ${joinHumanList(pantryNames)} with only small measured flavor additions.`,
    macroRating: macros.protein >= 25 && macros.calories <= TYPE_LIMITS[mealType].calories[1] ? 'PANTRY FIT' : 'FIT',
    prepTime: mealType === 'Snack' ? '5-10 min' : '15-25 min',
    macros,
    ingredients: [...measuredPantry, ...flavor.smallAdds],
    pantryUsed: pantryNames,
    smallAdds: flavor.smallAdds,
    steps: [
      `Prep ${joinHumanList(pantryNames)}.`,
      main.kind === 'protein'
        ? `Cook or warm the ${main.label.toLowerCase()} until ready.`
        : `Warm or assemble the ${main.label.toLowerCase()} as the base.`,
      'Combine the pantry ingredients in a bowl, skillet, plate, or container.',
      flavor.finish
    ],
    sources: []
  };
}

function choosePantryItems(pantryItems, main, mealType, index) {
  const rotated = rotateItems(pantryItems, index).filter((item) => item.key !== main.key);
  const desiredCount = mealType === 'Snack' ? 3 : 5;
  const selected = [main];

  for (const preferredKind of ['starch', 'vegetable', 'fruit', 'sauce', 'protein', 'other']) {
    for (const item of rotated.filter((candidate) => candidate.kind === preferredKind)) {
      if (selected.length >= desiredCount) break;
      if (!selected.some((existing) => existing.key === item.key)) selected.push(item);
    }
  }

  return selected.slice(0, desiredCount);
}

function rotateItems(items, offset) {
  if (!items.length) return [];
  return items.map((_, index) => items[(index + offset) % items.length]);
}

function chooseFlavor(mealType, index) {
  if (mealType === 'Snack') {
    const snackFlavors = FLAVOR_SETS.filter((flavor) => flavor.label === 'Cinnamon' || flavor.label === 'Lime Chili');
    return snackFlavors[index % snackFlavors.length];
  }

  return FLAVOR_SETS[index % (FLAVOR_SETS.length - 1)];
}

function parseIngredients(value = '') {
  return String(value || '')
    .split(/[,;\n]/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean)
    .map((ingredient) => ingredient.replace(/\s+/g, ' '))
    .filter((ingredient, index, list) => list.findIndex((item) => normalizeText(item) === normalizeText(ingredient)) === index)
    .slice(0, 18);
}

function classifyIngredient(rawValue) {
  const value = normalizeText(rawValue);
  const label = toTitleCase(rawValue);

  const matchers = [
    [/chicken|breast/, { label: 'Chicken Breast', kind: 'protein', measurement: '1 chicken breast (~6 oz)', macros: [280, 52, 0, 6] }],
    [/turkey/, { label: '93% Lean Ground Turkey', kind: 'protein', measurement: '6 oz 93% lean ground turkey', macros: [260, 40, 0, 12] }],
    [/beef|steak|sirloin/, { label: value.includes('steak') || value.includes('sirloin') ? 'Sirloin Steak' : 'Lean Beef', kind: 'protein', measurement: '6 oz lean beef or steak', macros: [330, 42, 0, 16] }],
    [/salmon/, { label: 'Salmon', kind: 'protein', measurement: '1 salmon fillet (~6 oz)', macros: [360, 38, 0, 20] }],
    [/shrimp/, { label: 'Shrimp', kind: 'protein', measurement: '6 oz shrimp', macros: [170, 36, 2, 2] }],
    [/tuna/, { label: 'Tuna', kind: 'protein', measurement: '1 can tuna, drained', macros: [150, 33, 0, 2] }],
    [/egg/, { label: 'Eggs', kind: 'protein', measurement: '2 eggs or 3/4 cup egg whites', macros: [210, 24, 2, 10] }],
    [/tofu/, { label: 'Extra-Firm Tofu', kind: 'protein', measurement: '6 oz extra-firm tofu', macros: [190, 22, 6, 10] }],
    [/greek yogurt|yogurt/, { label: 'Greek Yogurt', kind: 'protein', measurement: '1 cup plain Greek yogurt', macros: [150, 25, 8, 0] }],
    [/cottage/, { label: 'Cottage Cheese', kind: 'protein', measurement: '1 cup low-fat cottage cheese', macros: [180, 28, 10, 3] }],
    [/beans|lentil/, { label, kind: 'protein', measurement: `1/2 cup ${rawValue}`, macros: [120, 8, 22, 1] }],
    [/rice|quinoa|pasta|oats|potato|tortilla|bread|wrap|cereal/, { label, kind: 'starch', measurement: starchMeasurement(rawValue), macros: [150, 4, 32, 2] }],
    [/broccoli|spinach|lettuce|romaine|cucumber|tomato|pepper|onion|zucchini|asparagus|green bean|vegetable|slaw|greens/, { label, kind: 'vegetable', measurement: vegetableMeasurement(rawValue), macros: [35, 2, 7, 0] }],
    [/berries|apple|banana|pineapple|fruit|orange|mango/, { label, kind: 'fruit', measurement: fruitMeasurement(rawValue), macros: [80, 1, 20, 0] }],
    [/avocado/, { label: 'Avocado', kind: 'vegetable', measurement: '1/4 avocado', macros: [80, 1, 4, 7] }],
    [/salsa|hot sauce|pesto|dressing|sauce|hummus|dip/, { label, kind: 'sauce', measurement: sauceMeasurement(rawValue), macros: [45, 1, 4, 3] }]
  ];

  const match = matchers.find(([pattern]) => pattern.test(value));
  const data = match ? match[1] : { label, kind: 'other', measurement: `1 serving ${rawValue}`, macros: [80, 3, 10, 2] };

  return {
    key: normalizeText(data.label),
    raw: rawValue,
    ...data
  };
}

function estimateMacros(items, smallAdds, mealType) {
  const totals = items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.macros[0],
      protein: sum.protein + item.macros[1],
      carbs: sum.carbs + item.macros[2],
      fat: sum.fat + item.macros[3]
    }),
    { calories: smallAdds.length * 4, protein: 0, carbs: smallAdds.length, fat: 0 }
  );
  const limits = TYPE_LIMITS[mealType] || TYPE_LIMITS.Dinner;

  return {
    calories: clamp(totals.calories, limits.calories[0], limits.calories[1]),
    protein: clamp(totals.protein, limits.protein[0], limits.protein[1]),
    carbs: clamp(totals.carbs, limits.carbs[0], limits.carbs[1]),
    fat: clamp(totals.fat, limits.fat[0], limits.fat[1])
  };
}

function normalizeMealType(value) {
  const normalized = toTitleCase(value || 'Dinner');
  return ['Breakfast', 'Lunch', 'Dinner', 'Snack'].includes(normalized) ? normalized : 'Dinner';
}

function defaultTime(mealType) {
  if (mealType === 'Breakfast') return '8:00 AM';
  if (mealType === 'Lunch') return '12:30 PM';
  if (mealType === 'Snack') return '3:30 PM';
  return '6:30 PM';
}

function starchMeasurement(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('tortilla') || normalized.includes('wrap')) return `1 ${value}`;
  if (normalized.includes('bread')) return `1 slice ${value}`;
  if (normalized.includes('potato')) return `1/2 cup ${value}`;
  return `1/2 cup cooked ${value}`;
}

function vegetableMeasurement(value) {
  return `1 cup ${value}`;
}

function fruitMeasurement(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('apple') || normalized.includes('banana') || normalized.includes('orange')) return `1 ${value}`;
  return `1/2 cup ${value}`;
}

function sauceMeasurement(value) {
  return `1 tbsp ${value}`;
}

function joinHumanList(values) {
  const clean = values.filter(Boolean);
  if (clean.length <= 1) return clean[0] || 'your pantry ingredients';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

function toTitleCase(value = '') {
  return String(value || '')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
