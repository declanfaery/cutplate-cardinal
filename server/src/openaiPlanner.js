import OpenAI from 'openai';
import { SOURCE_POLICY_NOTES, getSourceSeeds } from './sources.js';
import { normalizePreferences } from './recipeEngine.js';
import { trackAnalyticsEvent } from './analytics.js';

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'mealType',
    'time',
    'name',
    'protein',
    'description',
    'macroRating',
    'prepTime',
    'macros',
    'ingredients',
    'steps',
    'sources',
    'sourceSearches'
  ],
  properties: {
    id: { type: 'string' },
    mealType: { type: 'string' },
    time: { type: 'string' },
    name: { type: 'string' },
    protein: { type: 'string' },
    description: { type: 'string' },
    macroRating: { type: 'string' },
    prepTime: { type: 'string' },
    macros: macroSchema(),
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'url', 'platform'],
        properties: {
          label: { type: 'string' },
          url: { type: 'string' },
          platform: { type: 'string' }
        }
      }
    },
    sourceSearches: { type: 'array', items: { type: 'string' } }
  }
};

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'days', 'recipeLibrary', 'shoppingList', 'sourceNotes', 'safetyNote'],
  properties: {
    title: { type: 'string' },
    summary: {
      type: 'object',
      additionalProperties: false,
      required: ['days', 'mealsPerDay', 'totalMeals', 'averageCalories', 'averageProtein', 'averageCarbs', 'averageFat'],
      properties: {
        days: { type: 'number' },
        mealsPerDay: { type: 'number' },
        totalMeals: { type: 'number' },
        averageCalories: { type: 'number' },
        averageProtein: { type: 'number' },
        averageCarbs: { type: 'number' },
        averageFat: { type: 'number' }
      }
    },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dayNumber', 'label', 'totals', 'meals'],
        properties: {
          dayNumber: { type: 'number' },
          label: { type: 'string' },
          totals: macroSchema(),
          meals: {
            type: 'array',
            items: RECIPE_SCHEMA
          }
        }
      }
    },
    recipeLibrary: { type: 'array', items: RECIPE_SCHEMA },
    shoppingList: { type: 'array', items: { type: 'string' } },
    sourceNotes: { type: 'array', items: { type: 'string' } },
    safetyNote: { type: 'string' }
  }
};

const PANTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recipes', 'usedIngredients', 'note'],
  properties: {
    recipes: { type: 'array', items: RECIPE_SCHEMA },
    usedIngredients: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' }
  }
};

const PANTRY_IMAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ingredients', 'proteins', 'note'],
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'category', 'confidence'],
        properties: {
          name: { type: 'string' },
          category: { type: 'string' },
          confidence: { type: 'string' }
        }
      }
    },
    proteins: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' }
  }
};

const AESTHETIC_RECIPE_GUIDANCE =
  'Broaden recipe horizons beyond repetitive bowls and macro plates. Favor visually appealing food that would photograph well after cooking: colorful salads, stuffed vegetables, bento-style boxes, open-faced toasts, skillet bakes, taco or lettuce-cup plates, kebab plates, sushi- or poke-inspired bowls, layered yogurt jars, crisp air-fryer items, flatbreads, wraps cut on a bias, sauced pastas that are not soupy, and sheet-pan trays with color contrast. Include edible garnish, texture, clean plating, and finish cues when they naturally fit the recipe. Do not add decorative ingredients unless they are measured edible ingredients.';

export async function generateAiMealPlan(input = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const preferences = normalizePreferences(input);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sourceSeeds = getSourceSeeds(preferences.sourceHandles);

  const useWebSearch = shouldUseWebSearch();
  const discoveryInstruction = sourceSeeds.length
    ? 'Use web search for recipe/source discovery across the public web and the selected public social creator seeds, but do not copy creator captions, recipes, or post text.'
    : 'Use web search for recipe/source discovery across the public web. Do not copy creator captions, recipes, or post text.';
  const response = await createTrackedResponse(client, {
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              `You create original, health-focused weight-loss meal plans. ${AESTHETIC_RECIPE_GUIDANCE} ${discoveryInstruction} Return only valid JSON matching the schema. Macro numbers must be realistic per-serving estimates, not full-recipe totals and not medical claims. The calorieTarget preference means target calories per meal for one serving, not a daily calorie target. servingsPerMeal affects ingredient quantities and grocery cost, but macros in the response must remain per-serving. Never put serving counts in recipe names. Respect the user grocery budget by using cheaper staples for low budgets and more premium proteins only when the budget allows it. Name turkey as 93% lean ground turkey unless the user explicitly asks for another cut. Use human-readable creator/source labels without @ handles in app output. Avoid starting recipe names with generic flavor prefixes like Smoky, Smokey, Citrus, Lime Chili, or Garlic Herb. Use Fahrenheit for all cooking temperatures. Recipe steps must be complete, cookable directions: usually 5-10 steps with prep, heat level, timing or visual cues, finishing, and food-safe temperatures where relevant. Do not collapse directions into vague summaries like "cook until done" or "serve over rice."`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(
              {
                task:
                  `Create a complete meal plan and a selectable recipeLibrary with exactly preferences.recipeOptionTarget sourced recipe options when possible. Use web-discovered recipes and public recipe/social inspiration as source material, then summarize/adapt in original words. ${AESTHETIC_RECIPE_GUIDANCE} At least half the recipeLibrary should be visually distinct formats or cuisines, not just bowls with different seasonings. Do not create repeated template names like Lime Chili Protein Bowl or Garlic Herb Protein Plate. Avoid recipe names that start with generic flavor words such as Smoky, Smokey, or Citrus. Recipe names should reflect the actual food and source concept. Do not return recipes named in preferences.excludeRecipeNames. Use source nutrition/macros when available; otherwise estimate per-serving macros from ingredient amounts. Do not use the same calorie number for every recipe. Use calorieTarget as the per-meal target for one serving. dailyCalorieTarget is calorieTarget multiplied by selected meals per day, and cookedDailyCalorieTarget is further multiplied by servingsPerMeal; use those derived values only for planning scale, not for per-serving macro output. Use the groceryBudget preference before choosing recipes. Treat the budget as the full selected menu budget, then divide by days * selected meal slots to reason about budget per recipe. Low budgets should lean on lower-cost real recipes and staples. Higher budgets can include premium recipes like steak, salmon, shrimp, quinoa, and higher-cost vegetables. If pantryIngredients are provided, prefer recipes that naturally use those ingredients without forcing them into every meal. List every seasoning and sauce as its own measured ingredient using tbsp or tsp. Do not use vague ingredients like seasonings, spices, or sauce to taste. Use Fahrenheit for all cooking temperatures. Return source-faithful, fully cookable steps rewritten in original words. Each recipe should usually have 5-10 steps and include pan/oven/air-fryer temperature, time, cues like browned/thickened/wilted, rest or serving instructions, and 165 F poultry safety when relevant. Do not return three-step summaries.`,
                preferences,
                sourceSeeds,
                sourcePolicy: SOURCE_POLICY_NOTES,
                ratingStyle:
                  'Use app-store-friendly macro ratings: SUPER FIT, FIT, or BALANCED. Do not use profanity in app output.'
              },
              null,
              2
            )
          }
        ]
      }
    ],
    ...(useWebSearch ? { tools: [{ type: 'web_search_preview', search_context_size: getSearchContextSize() }] } : {}),
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
    text: {
      format: {
        type: 'json_schema',
        name: 'meal_plan',
        strict: true,
        schema: PLAN_SCHEMA
      }
    }
  }, {
    feature: 'meal_plan',
    analyticsContext: input.analyticsContext,
    webSearch: useWebSearch
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error('OpenAI returned an empty meal plan.');
  }

  const plan = normalizeGeneratedPlan(JSON.parse(outputText));
  return {
    ...plan,
    id: `ai-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    generatedBy: process.env.OPENAI_MODEL || 'gpt-5-nano',
    preferences
  };
}

export async function analyzePantryImage(input = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const imageBase64 = String(input.imageBase64 || '').trim();
  const mimeType = normalizeImageMimeType(input.mimeType);

  if (!imageBase64) {
    const error = new Error('Add a pantry photo first.');
    error.status = 400;
    throw error;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await createTrackedResponse(client, {
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              'You identify visible pantry, fridge, freezer, and countertop food items from a user photo for a meal-planning app. Return only items that are reasonably visible or strongly implied by readable packaging. Do not invent hidden ingredients. Keep names grocery-friendly, concise, and singular where possible. The proteins array is only for true primary proteins such as chicken, turkey, beef, pork, sausage, fish, seafood, eggs, tofu, tempeh, beans, lentils, Greek yogurt, or cottage cheese. Never classify protein pasta, boxed macaroni, cheese sauce, snack foods, or tomato sauce as proteins.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'Analyze this pantry/fridge photo. Return likely usable ingredients, identify any visible primary proteins separately, and include a short note if the photo is blurry, blocked, or missing obvious protein items. Do not return labels that say no, maybe, unknown, or question-mark guesses as ingredients. Confidence must be high, medium, or low.'
          },
          {
            type: 'input_image',
            image_url: `data:${mimeType};base64,${imageBase64}`
          }
        ]
      }
    ],
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
    text: {
      format: {
        type: 'json_schema',
        name: 'pantry_image',
        strict: true,
        schema: PANTRY_IMAGE_SCHEMA
      }
    }
  }, {
    feature: 'pantry_scan',
    analyticsContext: input.analyticsContext,
    webSearch: false
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error('OpenAI returned empty pantry photo analysis.');
  }

  const payload = JSON.parse(outputText);
  const ingredients = dedupeIngredientObjects(payload.ingredients || []);
  const proteins = filterProteinNames(dedupeStrings(payload.proteins || []));

  return {
    ingredients,
    proteins,
    ingredientNames: ingredients.map((ingredient) => ingredient.name),
    note: payload.note || ''
  };
}

export async function generateSourcedPantryRecipes(input = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mealType = String(input.mealType || 'Dinner').trim() || 'Dinner';
  const pantryIngredients = String(input.ingredients || input.pantryIngredients || '').trim();
  const sourceSeeds = getSourceSeeds(input.sourceHandles || []);
  const recipeCount = normalizeRecipeCount(input.recipeCount, 9);
  const excludeRecipeNames = dedupeStrings(input.excludeRecipeNames || []);

  if (!pantryIngredients) {
    const error = new Error('Enter pantry or fridge ingredients first.');
    error.status = 400;
    throw error;
  }

  const response = await createTrackedResponse(client, {
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              `You find real recipe ideas from the public web and selected public social recipe sources, then return original summaries for a pantry-first cooking app. ${AESTHETIC_RECIPE_GUIDANCE} Do not ask the user for permission or say you can start a live web search; do the search now and return recipes. Do not copy recipe pages, captions, or creator text. Treat the pantry list as available inventory, not a requirement to use everything. Each returned recipe should use a coherent subset of pantry items: usually one primary protein plus one starch or vegetable plus a compatible sauce/seasoning. It is better to leave pantry items unused than to combine mismatched items such as salmon, pasta, and mashed potatoes in one dish. Optional additions must be small pantry staples only: measured dried spices, herbs, oil, citrus/vinegar, hot sauce, broth/water, salt, or pepper. Do not add specialty dairy, cheese sauces, cream sauces, cottage cheese, fresh cheeses, milk, butter, flour, meat, seafood, or vegetables unless they are visible/typed pantry ingredients. Do not include optional major ingredients outside the pantry list. If the user typed a specific protein cut, such as chicken breast, use that cut and do not swap to ground chicken or another meat. If the pantry includes a boxed mac, cheese sauce, or packaged cheese item, use that exact item only; do not invent extra milk, butter, parmesan, cream, or fresh cheese. For Lunch or Dinner, ignore snack foods like pretzels, popcorn, chips, crackers, and cookies unless the user explicitly selected Snack. Do not mash two unrelated recipes into one dish. A source link must match the same dish family as the returned recipe, not just share one ingredient. Macro numbers must be per serving. The calorieTarget input means target calories for this one meal serving, not a daily target. Recipe steps must be source-faithful and cookable, rewritten in original words: usually 5-10 steps with prep, heat level, timing or visual cues, finishing, and food-safe temperatures where relevant. Never return vague three-step summaries. Return only valid JSON matching the schema.`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify(
              {
                task:
                  `Find and summarize real recipe options for the requested meal type using a sensible subset of the provided pantry/fridge ingredients as the core. Use the web search tool now. Return exactly recipeCount different recipes. If exact web matches are sparse, use source-backed dish families and create original pantry-first variants that still obey the ingredient limits. ${AESTHETIC_RECIPE_GUIDANCE} Do not ask whether to proceed. Do not force every pantry ingredient into each recipe. Vary the subsets across recipes: for example, if pantry has salmon, pasta, and mashed potatoes, make separate coherent ideas rather than one salmon-pasta-potato recipe. Recipe names should be specific to the source-backed food concept, not generic flavor templates. Do not return recipes named in excludeRecipeNames. Include source links whose recipe concept directly matches each returned dish. For example, do not cite a mac and cheese recipe for a tomato penne recipe, and do not add four-cheese sauce to a tomato pasta unless cheese sauce is in the user pantry ingredients. For dinner/lunch, avoid snack-crusted or novelty snack recipes from pretzels, popcorn, chips, or crackers. Use source nutrition/macros when available; otherwise estimate per-serving macros from the returned ingredient amounts. List seasonings/sauces with tbsp/tsp measurements. Steps should be plain sentences without leading numbers. Return complete cookable directions, not summaries: usually 5-10 steps that explain prep, cooking vessel, heat level or Fahrenheit temperature, timing, doneness cues, sauce/assembly order, serving, and safe internal temperature for poultry.`,
                recipeCount,
                mealType,
                pantryIngredients,
                excludeRecipeNames,
                searchVariant: input.searchVariant || 'initial pantry recipe search',
                allergies: input.allergies || [],
                dietStyle: input.dietStyle || 'High protein',
                calorieTarget: input.calorieTarget || null,
                sourceSeeds,
                sourcePolicy: SOURCE_POLICY_NOTES
              },
              null,
              2
            )
          }
        ]
      }
    ],
    tools: [{ type: 'web_search_preview', search_context_size: getSearchContextSize() }],
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
    text: {
      format: {
        type: 'json_schema',
        name: 'pantry_recipes',
        strict: true,
        schema: PANTRY_SCHEMA
      }
    }
  }, {
    feature: 'pantry_recipes',
    analyticsContext: input.analyticsContext,
    webSearch: true
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error('OpenAI returned empty pantry recipes.');
  }

  const payload = JSON.parse(outputText);
  return {
    ...payload,
    recipes: payload.recipes.map((recipe, index) => normalizeGeneratedRecipe(recipe, index, mealType))
  };
}

export function normalizeGeneratedRecipe(recipe = {}, index, mealType) {
  const id = recipe.id || `pantry-sourced-${index + 1}`;
  return {
    ...recipe,
    id,
    optionKey: recipe.optionKey || id,
    mealType: recipe.mealType || mealType,
    time: recipe.time || defaultTime(mealType),
    name: cleanRecipeTitle(recipe.name, `Recipe ${index + 1}`),
    macroRating: normalizeMacroRating(recipe.macroRating),
    ingredients: Array.isArray(recipe.ingredients)
      ? normalizeIngredientLines(recipe.ingredients)
      : [],
    steps: Array.isArray(recipe.steps) ? normalizeStepLines(recipe.steps) : [],
    sources: Array.isArray(recipe.sources)
      ? recipe.sources.filter((source) => source?.url && source?.label).slice(0, 3)
      : []
  };
}

export function hasCookableRecipeSteps(recipe = {}) {
  const steps = normalizeStepLines(recipe.steps || []);
  if (steps.length < 5) return false;

  const meaningfulSteps = steps.filter((step) => wordCount(step) >= 7);
  if (meaningfulSteps.length < Math.min(5, steps.length)) return false;

  const joined = steps.join(' ').toLowerCase();
  const searchableSteps = joined.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hasCookingAction = /\b(preheat|bake|air fry|air-fry|sear|saute|simmer|boil|grill|roast|cook|microwave|toast|broil)\b/i.test(searchableSteps);
  const hasTimingOrCue = /\b(\d+\s*(?:-|to)?\s*\d*\s*(?:minute|minutes|min|hour|hours)|until|golden|browned|thickened|wilted|tender|crisp|melted|reaches|internal)\b/i.test(joined);
  const hasPrepOrFinish = /\b(season|slice|dice|chop|mix|whisk|stir|combine|toss|assemble|garnish|serve|rest|cool|store|freeze|reheat)\b/i.test(joined);

  if (!hasCookingAction || !hasTimingOrCue || !hasPrepOrFinish) return false;

  const genericStepCount = steps.filter((step) => isGenericSummaryStep(step)).length;
  return genericStepCount <= 1;
}

function cleanRecipeTitle(value = '', fallback = 'Recipe') {
  const title = String(value || '').trim() || fallback;
  return title
    .replace(/^(smoky|smokey|citrus)\s*[-:–—]?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function normalizeGeneratedPlan(plan = {}) {
  const recipeLibrary = Array.isArray(plan.recipeLibrary)
    ? plan.recipeLibrary.map((recipe, index) => normalizeGeneratedRecipe(recipe, index, recipe.mealType))
    : [];

  const days = Array.isArray(plan.days)
    ? plan.days.map((day) => ({
        ...day,
        meals: Array.isArray(day.meals)
          ? day.meals.map((meal, index) => normalizeGeneratedRecipe(meal, index, meal.mealType))
          : []
      }))
    : [];

  return {
    ...plan,
    days,
    recipeLibrary
  };
}

function normalizeIngredientLines(ingredients = []) {
  const normalized = [];
  const seen = new Set();

  for (const ingredient of ingredients) {
    const line = String(ingredient || '').trim();
    if (!line) continue;

    for (const expanded of expandBareSeasoning(line)) {
      const key = expanded.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(expanded);
    }
  }

  return normalized;
}

function expandBareSeasoning(line = '') {
  const normalized = line
    .trim()
    .toLowerCase()
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ');

  if (!normalized) return [];
  if (hasMeasurement(normalized)) return [line];

  if (/^(salt and pepper|salt & pepper)( to taste)?$/.test(normalized)) {
    return ['1/4 tsp kosher salt', '1/4 tsp black pepper'];
  }

  const seasoningMeasurements = [
    [/^(salt|kosher salt|sea salt)( to taste)?$/, '1/4 tsp kosher salt'],
    [/^(pepper|black pepper|cracked pepper)( to taste)?$/, '1/4 tsp black pepper'],
    [/^(parsley|dried parsley|parsley flakes)( to taste)?$/, '1 tsp dried parsley'],
    [/^(basil|dried basil)( to taste)?$/, '1 tsp dried basil'],
    [/^(oregano|dried oregano)( to taste)?$/, '1 tsp dried oregano'],
    [/^(thyme|dried thyme)( to taste)?$/, '1/2 tsp dried thyme'],
    [/^(rosemary|dried rosemary)( to taste)?$/, '1/2 tsp dried rosemary'],
    [/^(italian seasoning)( to taste)?$/, '1 tsp Italian seasoning'],
    [/^(garlic powder)( to taste)?$/, '1/2 tsp garlic powder'],
    [/^(onion powder)( to taste)?$/, '1/2 tsp onion powder'],
    [/^(chili powder)( to taste)?$/, '1/2 tsp chili powder'],
    [/^(paprika|smoked paprika)( to taste)?$/, `1 tsp ${normalized.replace(/ to taste$/, '')}`],
    [/^(cumin|ground cumin)( to taste)?$/, '1/2 tsp ground cumin'],
    [/^(coriander|ground coriander)( to taste)?$/, '1/2 tsp ground coriander'],
    [/^(red pepper flakes|crushed red pepper)( to taste)?$/, '1/4 tsp red pepper flakes'],
    [/^(cinnamon|ground cinnamon)( to taste)?$/, '1/4 tsp ground cinnamon'],
    [/^(dill|dried dill)( to taste)?$/, '1 tsp dried dill']
  ];

  for (const [pattern, measured] of seasoningMeasurements) {
    if (pattern.test(normalized)) return [measured];
  }

  return [line];
}

function hasMeasurement(value = '') {
  return /(^|\s)(\d+|one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|pinch|dash)\b/i.test(value)
    || /\b(tsp|teaspoon|tbsp|tablespoon|cup|cups|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|ml|liter|litre|clove|cloves|can|cans|jar|jars|package|packages|box|boxes|bag|bags)\b/i.test(value);
}

function normalizeMacroRating(value = '') {
  const rating = String(value || '').trim().toUpperCase();
  if (rating.includes('SUPER')) return 'SUPER FIT';
  if (rating.includes('BALANCED')) return 'BALANCED';
  return 'FIT';
}

function normalizeStepLines(steps = []) {
  const normalized = [];
  const seen = new Set();

  for (const step of steps) {
    const cleaned = convertTemperaturesToFahrenheit(stripLeadingStepNumber(step))
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(cleaned);
  }

  return normalized;
}

function stripLeadingStepNumber(value = '') {
  return String(value || '').trim().replace(/^(\s*\d+[\).]\s*)+/, '');
}

function convertTemperaturesToFahrenheit(value = '') {
  return String(value || '')
    .replace(/(\d{2,3})\s*(?:°\s*)?C\b/gi, (_, celsius) => `${Math.round(Number(celsius) * 9 / 5 + 32)} F`)
    .replace(/(\d{3})\s*(?:°\s*)?F\b/gi, (_, fahrenheit) => `${fahrenheit} F`);
}

function wordCount(value = '') {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function isGenericSummaryStep(value = '') {
  const step = String(value || '').trim().toLowerCase();
  return [
    /^cook .* until (done|cooked|ready)\.?$/,
    /^cook or warm .* until ready\.?$/,
    /^prepare the vegetables and carb base\.?$/,
    /^build the meal in a bowl or plate\.?$/,
    /^serve over [a-z\s]+\.?$/,
    /^season and cook .* until (done|cooked)\.?$/,
    /^finish with .*\.?$/
  ].some((pattern) => pattern.test(step));
}

function normalizeRecipeCount(value, fallback = 9) {
  const count = Number(value || fallback);
  if (!Number.isFinite(count)) return fallback;
  return Math.min(12, Math.max(3, Math.round(count)));
}

function shouldUseWebSearch() {
  return !/^(0|false|no)$/i.test(String(process.env.PLAN_WEB_SEARCH_DISABLED || ''));
}

function getSearchContextSize() {
  const value = String(process.env.PLAN_WEB_SEARCH_CONTEXT || 'medium').trim().toLowerCase();
  return ['low', 'medium', 'high'].includes(value) ? value : 'medium';
}

function defaultTime(mealType) {
  if (mealType === 'Breakfast') return '8:00 AM';
  if (mealType === 'Lunch') return '12:30 PM';
  if (mealType === 'Snack') return '3:30 PM';
  return '6:30 PM';
}

function normalizeImageMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase();
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
    return mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  }
  return 'image/jpeg';
}

function dedupeIngredientObjects(items) {
  const seen = new Set();
  const cleaned = [];

  for (const item of items) {
    const name = cleanDetectedIngredientName(item?.name);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      name,
      category: String(item?.category || 'pantry').trim() || 'pantry',
      confidence: normalizeConfidence(item?.confidence)
    });
  }

  return cleaned.slice(0, 30);
}

function cleanDetectedIngredientName(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (/\b(no|unknown|unclear|maybe)\b/.test(lower) || raw.includes('?')) return '';

  return raw
    .replace(/\s*\([^)]*(maybe|unclear|unknown|no)[^)]*\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filterProteinNames(items = []) {
  const allowedProteinPattern = /\b(chicken|turkey|beef|steak|pork|sausage|fish|salmon|tuna|tilapia|cod|shrimp|seafood|egg|eggs|tofu|tempeh|beans?|lentils?|chickpeas?|greek yogurt|cottage cheese)\b/i;
  const blockedProteinPattern = /\b(protein pasta|protein penne|penne|pasta|macaroni|shells|cheddar|cheese sauce|four cheese|tomato sauce|marinara|pretzel|popcorn|chips?|crackers?)\b/i;

  return items.filter((item) => allowedProteinPattern.test(item) && !blockedProteinPattern.test(item));
}

function dedupeStrings(items) {
  const seen = new Set();
  const cleaned = [];

  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);
  }

  return cleaned.slice(0, 12);
}

function normalizeConfidence(value) {
  const confidence = String(value || '').trim().toLowerCase();
  return ['high', 'medium', 'low'].includes(confidence) ? confidence : 'medium';
}

function macroSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['calories', 'protein', 'carbs', 'fat'],
    properties: {
      calories: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' }
    }
  };
}

async function createTrackedResponse(client, request, {
  feature,
  analyticsContext = {},
  webSearch = false
} = {}) {
  const startedAt = Date.now();
  const model = String(request?.model || process.env.OPENAI_MODEL || '').trim();

  try {
    const response = await client.responses.create(request);
    const usage = normalizeOpenAiUsage(response?.usage);
    await safelyTrackAiEvent({
      ...analyticsContext,
      eventName: 'ai_request_completed',
      properties: {
        feature,
        model,
        webSearch,
        durationMs: Date.now() - startedAt,
        ...usage,
        estimatedCostUsd: estimateOpenAiCost(usage)
      }
    });
    return response;
  } catch (error) {
    await safelyTrackAiEvent({
      ...analyticsContext,
      eventName: 'ai_request_failed',
      properties: {
        feature,
        model,
        webSearch,
        durationMs: Date.now() - startedAt,
        errorType: classifyAiError(error)
      }
    });
    throw error;
  }
}

function normalizeOpenAiUsage(usage = {}) {
  const inputTokens = toFiniteNumber(usage.input_tokens ?? usage.inputTokens);
  const outputTokens = toFiniteNumber(usage.output_tokens ?? usage.outputTokens);
  const totalTokens = toFiniteNumber(usage.total_tokens ?? usage.totalTokens)
    || inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function estimateOpenAiCost({ inputTokens = 0, outputTokens = 0 } = {}) {
  const inputRate = toFiniteNumber(process.env.OPENAI_INPUT_COST_PER_1M);
  const outputRate = toFiniteNumber(process.env.OPENAI_OUTPUT_COST_PER_1M);
  if (inputRate <= 0 && outputRate <= 0) return null;

  return Number((
    (inputTokens / 1_000_000) * inputRate
    + (outputTokens / 1_000_000) * outputRate
  ).toFixed(6));
}

async function safelyTrackAiEvent(input) {
  try {
    await trackAnalyticsEvent(input);
  } catch {
    // Analytics must never block recipe generation.
  }
}

function classifyAiError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const message = String(error?.message || '').toLowerCase();
  if (status === 429 || /rate limit/.test(message)) return 'rate_limit';
  if (status === 401 || status === 403) return 'authorization';
  if (status >= 500 || /timeout|timed out|etimedout/.test(message)) return 'provider';
  return 'request';
}

function toFiniteNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}
