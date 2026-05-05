import { SOURCE_POLICY_NOTES, buildSearchQueries, getSourceSeeds } from './sources.js';
import { attachGroceryEstimate } from './costEstimator.js';
import { attachRecipeLibrary } from './recipeLibrary.js';

const ALLOWED_DAYS = new Set([3, 5, 7, 10]);
const DEFAULT_MEAL_SLOTS = [
  { type: 'Lunch', time: '12:30 PM' },
  { type: 'Dinner', time: '6:30 PM' }
];

const KNOWN_PROTEINS = {
  chicken: { label: 'Chicken Breast', calories: 185, protein: 38, carbs: 0, fat: 4 },
  turkey: { label: '93% Lean Ground Turkey', calories: 205, protein: 36, carbs: 0, fat: 7 },
  beef: { label: '96 Percent Lean Beef', calories: 220, protein: 34, carbs: 0, fat: 9 },
  salmon: { label: 'Salmon', calories: 280, protein: 34, carbs: 0, fat: 15 },
  tuna: { label: 'Tuna', calories: 150, protein: 33, carbs: 0, fat: 2 },
  shrimp: { label: 'Shrimp', calories: 135, protein: 30, carbs: 1, fat: 2 },
  eggs: { label: 'Eggs and Egg Whites', calories: 210, protein: 28, carbs: 2, fat: 10 },
  tofu: { label: 'Extra-Firm Tofu', calories: 190, protein: 22, carbs: 6, fat: 10 },
  yogurt: { label: 'Greek Yogurt', calories: 160, protein: 28, carbs: 8, fat: 0 },
  cottage: { label: 'Low-Fat Cottage Cheese', calories: 180, protein: 28, carbs: 10, fat: 3 }
};

const MEAL_TEMPLATES = {
  Breakfast: [
    {
      name: '{protein} Sunrise Bowl',
      description: 'A lean, filling breakfast bowl with slow carbs, crisp vegetables, and a creamy high-protein finish.',
      addCalories: 180,
      addProtein: 6,
      addCarbs: 27,
      addFat: 5,
      ingredients: [
        '1 serving {protein}',
        '1/2 cup roasted sweet potato',
        '1 cup spinach',
        '1/4 avocado',
        '2 tbsp salsa',
        '1 tbsp lime juice',
        '1/2 tsp chili powder',
        '1/4 tsp kosher salt',
        '1/4 tsp black pepper'
      ],
      steps: [
        'Season the {protein} with chili powder, salt, pepper, and lime juice.',
        'Cook in a nonstick pan until hot and lightly browned.',
        'Layer spinach, sweet potato, and the cooked {protein} in a bowl.',
        'Top with avocado and salsa.'
      ]
    },
    {
      name: 'High-Protein {protein} Scramble Plate',
      description: 'A quick morning plate built around protein, volume vegetables, and a light sauce.',
      addCalories: 150,
      addProtein: 8,
      addCarbs: 16,
      addFat: 6,
      ingredients: [
        '1 serving {protein}',
        '3/4 cup egg whites',
        '1 cup peppers and onions',
        '1 light whole-grain tortilla',
        '1 tbsp hot sauce or pico de gallo',
        '1/4 tsp garlic powder'
      ],
      steps: [
        'Saute peppers and onions in a sprayed skillet.',
        'Add egg whites and stir until just set.',
        'Fold in warmed {protein}.',
        'Serve with the tortilla and hot sauce.'
      ]
    }
  ],
  Lunch: [
    {
      name: '{protein} Power Bowl',
      description: 'A meal-prep friendly bowl with high protein, big volume, and a bright sauce.',
      addCalories: 230,
      addProtein: 5,
      addCarbs: 38,
      addFat: 6,
      ingredients: [
        '1 serving {protein}',
        '3/4 cup cooked jasmine rice or cauliflower rice blend',
        '2 cups shredded lettuce',
        '1/2 cup cucumber',
        '1/2 cup tomatoes',
        '2 tbsp light Greek yogurt sauce',
        '1/2 tsp garlic powder',
        '1/2 tsp paprika',
        '1 tbsp lemon juice',
        '1/4 tsp kosher salt',
        '1/4 tsp black pepper'
      ],
      steps: [
        'Cook or reheat the {protein} with garlic, paprika, and black pepper.',
        'Build the bowl with rice, lettuce, cucumber, and tomatoes.',
        'Whisk Greek yogurt with lemon, garlic, and a pinch of salt.',
        'Add the {protein} and drizzle the sauce over the top.'
      ]
    },
    {
      name: '{protein} Crunch Wrap Salad',
      description: 'A low-calorie, high-crunch lunch that keeps the protein high without feeling tiny.',
      addCalories: 205,
      addProtein: 4,
      addCarbs: 26,
      addFat: 7,
      ingredients: [
        '1 serving {protein}',
        '2 cups romaine',
        '1/2 cup black beans',
        '1/3 cup corn',
        '1 tbsp reduced-fat cheese',
        '1 tbsp light ranch or salsa ranch',
        '1/2 tsp taco seasoning',
        '1/4 tsp black pepper'
      ],
      steps: [
        'Season and warm the {protein}.',
        'Toss romaine, beans, corn, and cheese in a large bowl.',
        'Slice the {protein} and place it over the salad.',
        'Finish with light dressing and cracked pepper.'
      ]
    }
  ],
  Dinner: [
    {
      name: 'Cut-Friendly {protein} Dinner Plate',
      description: 'A simple dinner plate with lean protein, high-volume vegetables, and enough carbs to stay satisfied.',
      addCalories: 255,
      addProtein: 5,
      addCarbs: 34,
      addFat: 8,
      ingredients: [
        '1 serving {protein}',
        '1 cup roasted broccoli',
        '1 cup zucchini or green beans',
        '1/2 cup cooked potatoes or rice',
        '1 tbsp low-sugar teriyaki or buffalo sauce',
        '1/2 tsp garlic powder',
        '1/4 tsp black pepper'
      ],
      steps: [
        'Roast vegetables at 425 F until browned at the edges.',
        'Cook the {protein} in a skillet or air fryer.',
        'Warm the potatoes or rice.',
        'Plate everything and brush the {protein} with sauce.'
      ]
    },
    {
      name: 'One-Pan {protein} Macro Skillet',
      description: 'A fast skillet meal designed for big flavor, easy cleanup, and weight-loss macros.',
      addCalories: 235,
      addProtein: 7,
      addCarbs: 28,
      addFat: 7,
      ingredients: [
        '1 serving {protein}',
        '1 cup frozen cauliflower rice',
        '1/2 cup cooked rice',
        '1 cup mixed vegetables',
        '1 tbsp light sauce',
        '1/2 tsp garlic powder',
        '1/2 tsp onion powder',
        '1/4 tsp red pepper flakes'
      ],
      steps: [
        'Brown the {protein} with garlic and onion powder.',
        'Add cauliflower rice, cooked rice, and mixed vegetables.',
        'Stir in the light sauce and cook until the pan is hot and glossy.',
        'Finish with red pepper flakes.'
      ]
    }
  ],
  Snack: [
    {
      name: '{protein} Protein Snack Box',
      description: 'A snack-sized protein hit with fruit or crunch to keep cravings under control.',
      addCalories: 115,
      addProtein: 5,
      addCarbs: 14,
      addFat: 3,
      ingredients: [
        '1 snack serving {protein}',
        '1 cup berries or sliced apple',
        '1 rice cake or mini tortilla',
        '1/2 tsp cinnamon or everything seasoning'
      ],
      steps: [
        'Portion the {protein} into a snack container.',
        'Add fruit and the rice cake or mini tortilla.',
        'Season lightly based on sweet or savory preference.',
        'Keep chilled until ready to eat.'
      ]
    },
    {
      name: 'Mini {protein} Recovery Bowl',
      description: 'A compact snack with enough protein to be useful and enough flavor to feel intentional.',
      addCalories: 130,
      addProtein: 6,
      addCarbs: 12,
      addFat: 4,
      ingredients: [
        '1 snack serving {protein}',
        '1/3 cup cucumber or berries',
        '1 tbsp light dip or sugar-free syrup',
        '1/8 tsp kosher salt or cinnamon'
      ],
      steps: [
        'Add the {protein} to a small bowl.',
        'Add cucumber for savory or berries for sweet.',
        'Top with light dip or sugar-free syrup.',
        'Season and serve cold.'
      ]
    }
  ]
};

export function normalizePreferences(input = {}) {
  const days = ALLOWED_DAYS.has(Number(input.days)) ? Number(input.days) : 5;
  const rawProteins = Array.isArray(input.proteins) ? input.proteins : [];
  const proteins = rawProteins
    .map((protein) => String(protein || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  const slotsFromInput = Array.isArray(input.mealSlots)
    ? input.mealSlots
    : Array.isArray(input.mealTypes)
      ? input.mealTypes.map((type) => ({ type, time: '' }))
      : [];

  const mealSlots = slotsFromInput
    .map((slot) => ({
      type: normalizeMealType(slot.type || slot.mealType),
      time: normalizeTime(slot.time)
    }))
    .filter((slot) => slot.type)
    .slice(0, 4);

  const calorieTarget = Number(input.calorieTarget);
  const servingsPerMeal = Number(input.servingsPerMeal);
  const groceryBudget = Number(input.groceryBudget ?? input.budgetTarget ?? input.budget);
  const mealSlotCount = mealSlots.length > 0 ? mealSlots.length : DEFAULT_MEAL_SLOTS.length;
  const recipeOptionTarget = normalizeRecipeOptionTarget(input.recipeOptionTarget, days, mealSlotCount);
  const recipeVarietyMode = normalizeRecipeVarietyMode(input.recipeVarietyMode || input.recipeVariety);
  const excludeRecipeNames = Array.isArray(input.excludeRecipeNames)
    ? input.excludeRecipeNames.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 120)
    : [];
  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((allergy) => String(allergy || '').trim()).filter(Boolean).slice(0, 16)
    : [];

  return {
    days,
    proteins: proteins.length > 0 ? proteins : ['Chicken', 'Turkey', 'Salmon'],
    mealSlots: mealSlots.length > 0 ? mealSlots : DEFAULT_MEAL_SLOTS,
    servingsPerMeal: Number.isFinite(servingsPerMeal) && servingsPerMeal > 0 ? Math.round(servingsPerMeal) : 2,
    allergies,
    location: cleanText(input.location, ''),
    groceryBudget: Number.isFinite(groceryBudget) && groceryBudget > 0 ? Math.round(groceryBudget) : null,
    calorieTarget: Number.isFinite(calorieTarget) && calorieTarget >= 100 ? Math.round(calorieTarget) : null,
    calorieTargetBasis: 'per_meal_per_serving',
    dailyCalorieTarget: Number.isFinite(calorieTarget) && calorieTarget >= 100
      ? Math.round(calorieTarget * (mealSlots.length > 0 ? mealSlots.length : DEFAULT_MEAL_SLOTS.length))
      : null,
    cookedDailyCalorieTarget: Number.isFinite(calorieTarget) && calorieTarget >= 100
      ? Math.round(calorieTarget * (mealSlots.length > 0 ? mealSlots.length : DEFAULT_MEAL_SLOTS.length) * (Number.isFinite(servingsPerMeal) && servingsPerMeal > 0 ? Math.round(servingsPerMeal) : 2))
      : null,
    dietStyle: cleanText(input.dietStyle, 'Balanced'),
    avoidIngredients: cleanText(input.avoidIngredients, ''),
    pantryIngredients: cleanText(input.pantryIngredients, ''),
    recipeOptionTarget,
    recipeVarietyMode,
    recipeMode: cleanText(input.recipeMode, ''),
    recipeVariant: cleanText(input.recipeVariant, ''),
    excludeRecipeNames,
    weekdaysOnly: Boolean(input.weekdaysOnly),
    sourceHandles: Array.isArray(input.sourceHandles)
      ? input.sourceHandles.map((handle) => String(handle).trim()).filter(Boolean)
      : []
  };
}

function normalizeRecipeOptionTarget(value, days, mealSlotCount) {
  const requested = Number(value);
  const computed = Math.max(40, Number(days || 0) * Math.max(1, Number(mealSlotCount || 1)) * 3);
  const target = Number.isFinite(requested) && requested > 0 ? requested : computed;
  return Math.min(80, Math.max(25, Math.round(target)));
}

function normalizeRecipeVarietyMode(value = '') {
  return String(value || '').trim().toLowerCase() === 'same' ? 'same' : 'different';
}

export function buildMealPlan(input = {}) {
  const preferences = normalizePreferences(input);
  const days = [];
  const shoppingMap = new Map();

  for (let dayIndex = 0; dayIndex < preferences.days; dayIndex += 1) {
    const meals = preferences.mealSlots.map((slot, slotIndex) => {
      const rawProtein = preferences.proteins[(dayIndex + slotIndex) % preferences.proteins.length];
      const meal = buildMeal({
        dayIndex,
        slotIndex,
        slot,
        rawProtein,
        preferences
      });

      meal.ingredients.forEach((ingredient) => {
        const key = ingredient.toLowerCase();
        shoppingMap.set(key, ingredient);
      });

      return meal;
    });

    days.push({
      dayNumber: dayIndex + 1,
      label: `Day ${dayIndex + 1}`,
      meals,
      totals: sumMacros(meals.map((meal) => meal.macros))
    });
  }

  const totals = sumMacros(days.flatMap((day) => day.meals.map((meal) => meal.macros)));
  const totalMeals = preferences.days * preferences.mealSlots.length;
  const dailyAverage = averageMacros(totals, preferences.days);

  const plan = {
    id: `local-${Date.now()}`,
    title: `${preferences.days}-Day CutPlate Plan`,
    generatedAt: new Date().toISOString(),
    generatedBy: 'local-recipe-engine',
    preferences,
    summary: {
      days: preferences.days,
      mealsPerDay: preferences.mealSlots.length,
      servingsPerMeal: preferences.servingsPerMeal,
      totalMeals,
      averageCalories: dailyAverage.calories,
      averageProtein: dailyAverage.protein,
      averageCarbs: dailyAverage.carbs,
      averageFat: dailyAverage.fat
    },
    days,
    shoppingList: Array.from(shoppingMap.values()).slice(0, 80),
    sourceNotes: SOURCE_POLICY_NOTES,
    safetyNote:
      'This plan is for general nutrition planning, not medical advice. Confirm macros against exact products and talk with a qualified professional for medical conditions.'
  };

  return attachGroceryEstimate(attachRecipeLibrary(plan, preferences), preferences);
}

function buildMeal({ dayIndex, slotIndex, slot, rawProtein, preferences }) {
  const protein = getProteinProfile(rawProtein);
  const templates = MEAL_TEMPLATES[slot.type] || MEAL_TEMPLATES.Lunch;
  const template = templates[(dayIndex + slotIndex) % templates.length];
  const isSnack = slot.type === 'Snack';
  const servingFactor = isSnack ? 0.55 : 1;
  const macros = {
    calories: Math.round(protein.calories * servingFactor + template.addCalories),
    protein: Math.round(protein.protein * servingFactor + template.addProtein),
    carbs: Math.round(protein.carbs * servingFactor + template.addCarbs),
    fat: Math.round(protein.fat * servingFactor + template.addFat)
  };

  const title = template.name.replaceAll('{protein}', protein.label);
  const sourceSeeds = getSourceSeeds(preferences.sourceHandles);
  const sources = sourceSeeds.length
    ? [
        sourceSeeds[(dayIndex + slotIndex) % sourceSeeds.length],
        sourceSeeds[(dayIndex + slotIndex + 1) % sourceSeeds.length]
      ].filter((source, index, list) => list.findIndex((item) => item.handle === source.handle) === index)
    : [];

  return {
    id: `${dayIndex + 1}-${slot.type.toLowerCase()}-${slotIndex}`,
    mealType: slot.type,
    time: slot.time,
    name: title,
    protein: protein.label,
    description: template.description.replaceAll('{protein}', protein.label.toLowerCase()),
    macroRating: macroRating(macros),
    prepTime: isSnack ? '5 min' : dayIndex % 2 === 0 ? '20 min' : '25 min',
    macros,
    ingredients: template.ingredients.map((ingredient) =>
      ingredient.replaceAll('{protein}', protein.label.toLowerCase())
    ),
    steps: template.steps.map((step) => step.replaceAll('{protein}', protein.label.toLowerCase())),
    sources: sources.map((source) => ({
      label: source.label,
      url: source.url,
      platform: source.platform
    })),
    sourceSearches: buildSearchQueries({
      protein: protein.label,
      mealType: slot.type,
      sourceHandles: preferences.sourceHandles
    })
  };
}

function normalizeMealType(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (normalized.startsWith('break')) return 'Breakfast';
  if (normalized.startsWith('lunch')) return 'Lunch';
  if (normalized.startsWith('din')) return 'Dinner';
  if (normalized.startsWith('snack')) return 'Snack';
  return '';
}

function normalizeTime(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed || '12:00 PM';
}

function cleanText(value, fallback) {
  const cleaned = String(value || '').trim();
  return cleaned || fallback;
}

function getProteinProfile(rawProtein) {
  const normalized = String(rawProtein || '').toLowerCase();
  const key = Object.keys(KNOWN_PROTEINS).find((proteinKey) => normalized.includes(proteinKey));
  if (key) return KNOWN_PROTEINS[key];

  const label = String(rawProtein || 'Lean protein').trim();
  return {
    label,
    calories: 205,
    protein: 34,
    carbs: 1,
    fat: 6
  };
}

function macroRating(macros) {
  if (macros.protein >= 35 && macros.calories <= 520) return 'SUPER FIT';
  if (macros.protein >= 25 && macros.calories <= 600) return 'FIT';
  return 'BALANCED';
}

function sumMacros(macrosList) {
  return macrosList.reduce(
    (total, macros) => ({
      calories: total.calories + macros.calories,
      protein: total.protein + macros.protein,
      carbs: total.carbs + macros.carbs,
      fat: total.fat + macros.fat
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function averageMacros(totals, count) {
  return {
    calories: Math.round(totals.calories / count),
    protein: Math.round(totals.protein / count),
    carbs: Math.round(totals.carbs / count),
    fat: Math.round(totals.fat / count)
  };
}
