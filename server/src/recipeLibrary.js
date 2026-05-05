import { buildSearchQueries, getSourceSeeds } from './sources.js';

const TYPE_TARGETS = {
  Breakfast: { calories: [300, 520], protein: [25, 45], carbs: [18, 55], fat: [6, 18] },
  Lunch: { calories: [380, 620], protein: [32, 55], carbs: [25, 65], fat: [8, 22] },
  Dinner: { calories: [430, 680], protein: [35, 60], carbs: [25, 70], fat: [10, 26] },
  Snack: { calories: [140, 320], protein: [15, 32], carbs: [8, 35], fat: [2, 12] }
};

const FORMATS = {
  Breakfast: [
    ['Protein Scramble Bowl', 'egg whites, peppers, spinach, and a crisp carb base'],
    ['Breakfast Taco Plate', 'egg whites, salsa, potatoes, and a light tortilla'],
    ['Greek Yogurt Power Bowl', 'Greek yogurt, berries, cereal crunch, and cinnamon'],
    ['Sweet Potato Hash', 'roasted sweet potato, greens, and a lean protein finish'],
    ['Protein Pancake Stack', 'high-protein pancakes with fruit and yogurt topping'],
    ['Breakfast Burrito Bowl', 'eggs, rice, pico, and a creamy low-calorie sauce'],
    ['Cottage Cheese Toast Plate', 'cottage cheese, fruit, and a savory protein side'],
    ['Lean Morning Skillet', 'skillet vegetables, potatoes, and seasoned protein'],
    ['Overnight Protein Oats', 'oats, Greek yogurt, berries, and light syrup'],
    ['Egg White Melt', 'egg whites, reduced-fat cheese, and vegetables']
  ],
  Lunch: [
    ['Power Bowl', 'rice or potatoes, crunchy vegetables, and a bright sauce'],
    ['Crunch Wrap Salad', 'romaine, beans, corn, salsa, and a lean protein'],
    ['Mediterranean Bowl', 'cucumber, tomatoes, rice, herbs, and yogurt sauce'],
    ['Burrito Bowl', 'beans, salsa, lettuce, rice, and a high-protein base'],
    ['Protein Pasta Salad', 'chilled pasta, vegetables, and a light creamy dressing'],
    ['Teriyaki Rice Bowl', 'rice, broccoli, sauce, and lean protein'],
    ['Buffalo Wrap Bowl', 'lettuce, potatoes, buffalo sauce, and yogurt ranch'],
    ['Street Corn Salad Bowl', 'corn, greens, salsa, and a seasoned protein'],
    ['Taco Cauliflower Bowl', 'cauliflower rice, beans, pico, and avocado'],
    ['Shawarma Style Bowl', 'cucumber, tomatoes, rice, lemon, and garlic sauce'],
    ['High-Volume Chopped Salad', 'greens, vegetables, beans, and a bold sauce'],
    ['Loaded Potato Bowl', 'potatoes, broccoli, light cheese, and protein']
  ],
  Dinner: [
    ['Macro Dinner Plate', 'roasted vegetables, potatoes, and a simple sauce'],
    ['One-Pan Skillet', 'cauliflower rice, vegetables, and a glossy light sauce'],
    ['Sheet Pan Dinner', 'roasted vegetables, potatoes, and lean protein'],
    ['Stir-Fry Bowl', 'rice, mixed vegetables, and a ginger garlic sauce'],
    ['Protein Mash Plate', 'sweet potato mash, greens, and a seasoned protein'],
    ['Fajita Plate', 'peppers, onions, rice, salsa, and a lean protein'],
    ['Lemon Herb Plate', 'green vegetables, potatoes, and lemon garlic sauce'],
    ['BBQ Bowl', 'rice, slaw, corn, and a low-sugar BBQ finish'],
    ['Pesto Veg Plate', 'zucchini, tomatoes, potatoes, and light pesto'],
    ['Garlic Parmesan Bowl', 'broccoli, rice, light cheese, and protein'],
    ['Red Pepper Skillet', 'mixed vegetables, rice, and roasted red pepper sauce'],
    ['Greek Dinner Bowl', 'rice, cucumber, tomatoes, and yogurt sauce']
  ],
  Snack: [
    ['Protein Snack Box', 'fruit, crunch, and a compact protein serving'],
    ['Recovery Yogurt Bowl', 'Greek yogurt, berries, and cereal crunch'],
    ['Mini Protein Wrap', 'a small tortilla, greens, and lean protein'],
    ['Cottage Cheese Fruit Bowl', 'cottage cheese, berries, and cinnamon'],
    ['Savory Crunch Plate', 'cucumber, dip, and a high-protein side'],
    ['Sweet Protein Cup', 'Greek yogurt, sugar-free syrup, and fruit'],
    ['Rice Cake Stack', 'rice cakes, protein topping, and seasoning'],
    ['Mini Taco Cup', 'beans, salsa, greens, and lean protein'],
    ['Protein Dip Box', 'light dip, vegetables, and a protein portion'],
    ['Berry Crunch Bowl', 'berries, yogurt, and a measured crunch topping']
  ]
};

const SIDES = [
  '1/2 cup cooked rice',
  '1 cup roasted broccoli',
  '1/2 cup sweet potato',
  '1 cup spinach',
  '1/2 cup cucumber',
  '1/2 cup tomatoes',
  '1/3 cup corn',
  '1/2 cup black beans',
  '1 light whole-grain tortilla',
  '2 tbsp Greek yogurt sauce',
  '1 tbsp salsa',
  '1 tbsp light dressing'
];

const SIDE_SETS = {
  low: [
    '1 cup cooked pasta',
    '1/2 cup brown rice',
    '1/2 cup black beans',
    '1 cup frozen broccoli',
    '1/2 cup sweet potato',
    '1 cup spinach',
    '1/3 cup corn',
    '1 tbsp salsa',
    '1 light whole-grain tortilla',
    '1 cup mixed vegetables',
    '1/2 cup tomatoes',
    '1 tbsp light dressing'
  ],
  standard: SIDES,
  high: [
    '1/2 cup cooked quinoa',
    '1 cup asparagus or green beans',
    '1/2 cup sweet potato',
    '1 cup spinach',
    '1/4 avocado',
    '1/2 cup cucumber',
    '1/2 cup tomatoes',
    '2 tbsp Greek yogurt sauce',
    '1/2 cup roasted broccoli',
    '1 tbsp light pesto',
    '1/2 cup black beans',
    '1 tbsp salsa'
  ]
};

const FLAVOR_VARIATIONS = [
  {
    prefix: '',
    lead: '',
    ingredients: ['1 tbsp lime juice', '1/2 tsp garlic powder', '1/2 tsp chili powder', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    snackIngredients: ['1/2 tsp cinnamon'],
    finish: 'Finish with lime juice and the measured seasonings.'
  },
  {
    prefix: 'Smoky ',
    lead: 'Smoky spices give this version extra flavor while keeping the calories controlled.',
    ingredients: ['1 tsp smoked paprika', '1/2 tsp garlic powder', '1 tbsp lime juice', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    snackIngredients: ['1/2 tsp smoked paprika', '1/4 tsp garlic powder'],
    finish: 'Finish with smoked paprika, lime juice, garlic powder, salt, and pepper.'
  },
  {
    prefix: 'Citrus ',
    lead: 'Citrus and herbs keep this version bright, fresh, and meal-prep friendly.',
    ingredients: ['1 tbsp lemon juice', '1 tsp dried parsley', '1/4 tsp garlic powder', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    snackIngredients: ['1 tsp lemon juice', '1/2 tsp cinnamon'],
    finish: 'Finish with lemon juice, dried parsley, garlic powder, salt, and pepper.'
  },
  {
    prefix: 'Buffalo ',
    lead: 'Buffalo-style seasoning makes this version bold without turning it into a heavy meal.',
    ingredients: ['1 tbsp hot sauce', '1 tbsp Greek yogurt sauce', '1/2 tsp garlic powder', '1/4 tsp black pepper'],
    snackIngredients: ['1 tbsp hot sauce', '1/4 tsp garlic powder'],
    finish: 'Finish with hot sauce, Greek yogurt sauce, garlic powder, and pepper.'
  },
  {
    prefix: 'Garlic Herb ',
    lead: 'Garlic and herbs make this version savory, simple, and easy to repeat.',
    ingredients: ['1 tbsp lemon juice', '1 tsp Italian seasoning', '1/2 tsp garlic powder', '1/4 tsp kosher salt', '1/4 tsp black pepper'],
    snackIngredients: ['1/2 tsp Italian seasoning', '1/4 tsp garlic powder'],
    finish: 'Finish with lemon juice, Italian seasoning, garlic powder, salt, and pepper.'
  }
];

export function attachRecipeLibrary(plan, preferences = plan.preferences || {}) {
  const recipeLibrary = buildRecipeLibrary(plan, preferences);
  return {
    ...plan,
    recipeLibrary
  };
}

export function buildRecipeLibrary(plan, preferences = {}) {
  const mealTypes = getMealTypes(preferences, plan);
  const totalTarget = getTotalTarget(mealTypes.length, preferences);
  const perType = Math.ceil(totalTarget / Math.max(1, mealTypes.length));

  return mealTypes.flatMap((mealType) =>
    Array.from({ length: perType }, (_, index) => buildOption({ mealType, index, preferences, plan }))
  ).slice(0, totalTarget);
}

function buildOption({ mealType, index, preferences, plan }) {
  const proteins = getBudgetAwareProteins(preferences, plan);
  const protein = proteins[index % proteins.length];
  const formats = FORMATS[mealType] || FORMATS.Lunch;
  const [format, descriptionTail] = formats[index % formats.length];
  const variation = FLAVOR_VARIATIONS[Math.floor(index / formats.length) % FLAVOR_VARIATIONS.length];
  const slot = (preferences.mealSlots || []).find((mealSlot) => mealSlot.type === mealType);
  const sources = getSourceSeeds(preferences.sourceHandles).slice(0, 2);
  const macros = buildMacros(mealType, index, protein, preferences);
  const name = `${variation.prefix}${cleanProteinName(protein)} ${format}`;
  const ingredients = buildIngredients(mealType, protein, index, variation, preferences);

  return {
    id: `library-${mealType.toLowerCase()}-${index + 1}`,
    optionKey: `library-${mealType.toLowerCase()}-${index + 1}`,
    mealType,
    time: slot?.time || defaultTime(mealType),
    name,
    protein: cleanProteinName(protein),
    description: `${variation.lead ? `${variation.lead} ` : ''}${descriptionTail} built as a weight-loss friendly, high-protein meal.`,
    macroRating: macros.protein >= 35 && macros.calories <= 620 ? 'SUPER FIT' : 'FIT',
    prepTime: mealType === 'Snack' ? '5 min' : index % 3 === 0 ? '20 min' : '25 min',
    macros,
    ingredients,
    steps: [
      `Season and cook the ${cleanProteinName(protein).toLowerCase()} until done.`,
      'Prepare the vegetables and carb base.',
      'Build the meal in a bowl or plate.',
      variation.finish
    ],
    sources: sources.map((source) => ({
      label: source.label,
      url: source.url,
      platform: source.platform
    })),
    sourceSearches: buildSearchQueries({
      protein: cleanProteinName(protein),
      mealType,
      sourceHandles: preferences.sourceHandles
    })
  };
}

function buildMacros(mealType, index, protein, preferences = {}) {
  const target = buildMacroTarget(mealType, preferences);
  const proteinBoost = /chicken|turkey|shrimp/i.test(protein) ? 7 : /yogurt|cottage|tofu/i.test(protein) ? -3 : 0;
  const fatBoost = /salmon|beef/i.test(protein) ? 5 : 0;
  const calorieDrift = ((index * 47 + protein.length * 13) % 111) - 55;
  const calories = clampNumber(target.calories + calorieDrift, target.minCalories, target.maxCalories);
  const proteinGrams = clampNumber(target.protein + ((index * 5) % 13) - 4 + proteinBoost, target.minProtein, target.maxProtein);
  const carbs = clampNumber(target.carbs + ((index * 7) % 19) - 8, target.minCarbs, target.maxCarbs);
  const fat = clampNumber(target.fat + ((index * 3) % 9) - 3 + fatBoost, target.minFat, target.maxFat);

  return {
    calories,
    protein: proteinGrams,
    carbs,
    fat
  };
}

function buildMacroTarget(mealType, preferences = {}) {
  const defaults = TYPE_TARGETS[mealType] || TYPE_TARGETS.Lunch;
  const calorieTarget = Number(preferences.calorieTarget);
  const centeredCalories = Number.isFinite(calorieTarget) && calorieTarget >= 100
    ? Math.round(calorieTarget)
    : Math.round((defaults.calories[0] + defaults.calories[1]) / 2);
  const calories = clampNumber(centeredCalories, defaults.calories[0], defaults.calories[1]);

  return {
    calories,
    minCalories: defaults.calories[0],
    maxCalories: defaults.calories[1],
    protein: clampNumber(Math.round((calories * 0.34) / 4), defaults.protein[0], defaults.protein[1]),
    minProtein: defaults.protein[0],
    maxProtein: defaults.protein[1],
    carbs: clampNumber(Math.round((calories * 0.36) / 4), defaults.carbs[0], defaults.carbs[1]),
    minCarbs: defaults.carbs[0],
    maxCarbs: defaults.carbs[1],
    fat: clampNumber(Math.round((calories * 0.24) / 9), defaults.fat[0], defaults.fat[1]),
    minFat: defaults.fat[0],
    maxFat: defaults.fat[1]
  };
}

function buildIngredients(mealType, protein, index, variation = FLAVOR_VARIATIONS[0], preferences = {}) {
  const proteinServing = mealType === 'Snack' ? `1 snack serving ${cleanProteinName(protein).toLowerCase()}` : `1 serving ${cleanProteinName(protein).toLowerCase()}`;
  const sides = getBudgetSides(preferences);
  const pantrySides = getPantrySides(preferences, sides);
  const offset = index % sides.length;
  const selectedSides = [
    ...pantrySides,
    sides[offset],
    sides[(offset + 3) % sides.length],
    sides[(offset + 6) % sides.length],
    sides[(offset + 9) % sides.length]
  ].filter((side, sideIndex, list) => list.findIndex((item) => item.toLowerCase() === side.toLowerCase()) === sideIndex).slice(0, 4);

  if (mealType === 'Snack') {
    return [
      proteinServing,
      '1 cup berries or sliced apple',
      '1 rice cake or mini tortilla',
      ...(variation.snackIngredients || ['1/2 tsp cinnamon'])
    ];
  }

  return [
    proteinServing,
    ...selectedSides,
    ...(variation.ingredients || [])
  ];
}

function getPantrySides(preferences = {}, sides = []) {
  const pantry = String(preferences.pantryIngredients || '')
    .toLowerCase()
    .split(',')
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);

  if (!pantry.length) return [];

  return sides.filter((side) => {
    const normalizedSide = side.toLowerCase();
    return pantry.some((ingredient) => normalizedSide.includes(ingredient));
  });
}

function getBudgetAwareProteins(preferences = {}, plan = {}) {
  const selected = preferences.proteins?.length ? preferences.proteins : ['Chicken', 'Turkey', 'Salmon'];
  const tier = getBudgetTier(preferences, plan);

  if (tier === 'low') {
    const cheap = selected.map((protein) => toBudgetProtein(protein)).filter(Boolean);
    const premium = selected.map((protein) => toOccasionalPremiumProtein(protein)).filter(Boolean);
    const pool = [...cheap, ...cheap, ...premium];
    return uniqueOrFallback(pool, cheap.length ? cheap : ['93% Lean Ground Turkey', 'Chicken Thighs']);
  }

  if (tier === 'high') {
    return uniqueOrFallback(
      selected.map((protein) => toPremiumProtein(protein)).sort((a, b) => rankProteinForTier(a, tier) - rankProteinForTier(b, tier)),
      ['Sirloin Steak', 'Salmon', 'Shrimp']
    );
  }

  return uniqueOrFallback(
    selected.map((protein) => toStandardProtein(protein)).sort((a, b) => rankProteinForTier(a, tier) - rankProteinForTier(b, tier)),
    ['Chicken Breast', '93% Lean Ground Turkey', 'Salmon']
  );
}

function getBudgetSides(preferences = {}, index = 0) {
  const tier = getBudgetTier(preferences, {});
  if (tier === 'low') return SIDE_SETS.low;
  if (tier === 'high') return SIDE_SETS.high;
  return SIDE_SETS.standard;
}

function getBudgetTier(preferences = {}, plan = {}) {
  const budget = Number(preferences.groceryBudget || preferences.budgetTarget || 0);
  if (!Number.isFinite(budget) || budget <= 0) return 'standard';

  const days = Number(preferences.days || plan.summary?.days || 1);
  const mealsPerDay = (preferences.mealSlots || []).length || Number(plan.summary?.mealsPerDay || 1);
  const totalMeals = Math.max(1, days * mealsPerDay);
  const budgetPerRecipe = budget / totalMeals;

  if (budgetPerRecipe < 7) return 'low';
  if (budgetPerRecipe >= 10) return 'high';
  return 'standard';
}

function toBudgetProtein(protein) {
  const value = String(protein || '').toLowerCase();
  if (value.includes('beef') || value.includes('steak')) return 'Lean Ground Beef';
  if (value.includes('turkey')) return '93% Lean Ground Turkey';
  if (value.includes('chicken')) return 'Chicken Thighs';
  if (value.includes('salmon')) return 'Canned Tuna';
  if (value.includes('shrimp')) return 'Eggs and Egg Whites';
  if (value.includes('yogurt')) return 'Greek Yogurt';
  if (value.includes('tofu')) return 'Extra-Firm Tofu';
  if (value.includes('egg')) return 'Eggs and Egg Whites';
  return cleanProteinName(protein);
}

function toOccasionalPremiumProtein(protein) {
  const value = String(protein || '').toLowerCase();
  if (value.includes('salmon')) return 'Salmon';
  if (value.includes('shrimp')) return 'Shrimp';
  return '';
}

function toStandardProtein(protein) {
  const value = String(protein || '').toLowerCase();
  if (value.includes('beef')) return 'Lean Beef';
  if (value.includes('turkey')) return '93% Lean Ground Turkey';
  if (value.includes('chicken')) return 'Chicken Breast';
  return cleanProteinName(protein);
}

function toPremiumProtein(protein) {
  const value = String(protein || '').toLowerCase();
  if (value.includes('beef')) return 'Sirloin Steak';
  if (value.includes('turkey')) return '93% Lean Ground Turkey';
  if (value.includes('chicken')) return 'Chicken Breast';
  return cleanProteinName(protein);
}

function uniqueOrFallback(values, fallback) {
  const unique = [...new Set(values.map((value) => cleanProteinName(value)).filter(Boolean))];
  return unique.length ? unique : fallback;
}

function rankProteinForTier(protein, tier) {
  const value = String(protein || '').toLowerCase();

  if (tier === 'high') {
    if (value.includes('steak') || value.includes('sirloin')) return 0;
    if (value.includes('salmon')) return 1;
    if (value.includes('shrimp')) return 2;
    if (value.includes('chicken')) return 3;
    if (value.includes('turkey')) return 4;
    if (value.includes('greek yogurt') || value.includes('yogurt')) return 5;
    if (value.includes('egg')) return 6;
    return 7;
  }

  if (value.includes('chicken')) return 0;
  if (value.includes('turkey')) return 1;
  if (value.includes('beef')) return 2;
  if (value.includes('salmon')) return 3;
  if (value.includes('greek yogurt') || value.includes('yogurt')) return 4;
  if (value.includes('egg')) return 5;
  return 6;
}

function getMealTypes(preferences, plan) {
  const fromPreferences = (preferences.mealSlots || []).map((slot) => slot.type).filter(Boolean);
  if (fromPreferences.length > 0) return [...new Set(fromPreferences)];

  const fromPlan = (plan.days || [])
    .flatMap((day) => day.meals || [])
    .map((meal) => meal.mealType)
    .filter(Boolean);

  return [...new Set(fromPlan)].length > 0 ? [...new Set(fromPlan)] : ['Lunch', 'Dinner'];
}

function getTotalTarget(typeCount, preferences = {}) {
  const requested = Number(preferences.recipeOptionTarget || 0);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.min(80, Math.max(25, Math.round(requested)));
  }

  if (typeCount <= 1) return 40;
  if (typeCount === 2) return 50;
  if (typeCount === 3) return 60;
  return 72;
}

function defaultTime(mealType) {
  if (mealType === 'Breakfast') return '8:00 AM';
  if (mealType === 'Lunch') return '12:30 PM';
  if (mealType === 'Dinner') return '6:30 PM';
  return '3:30 PM';
}

function cleanProteinName(value) {
  return String(value || 'Lean Protein').trim();
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
