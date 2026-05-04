import OpenAI from 'openai';
import { SOURCE_POLICY_NOTES, getSourceSeeds } from './sources.js';
import { normalizePreferences } from './recipeEngine.js';

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
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              `You create original, health-focused weight-loss meal plans. ${discoveryInstruction} Return only valid JSON matching the schema. Macro numbers must be realistic per-serving estimates, not full-recipe totals and not medical claims. The calorieTarget preference means target calories per meal for one serving, not a daily calorie target. servingsPerMeal affects ingredient quantities and grocery cost, but macros in the response must remain per-serving. Never put serving counts in recipe names. Respect the user grocery budget by using cheaper staples for low budgets and more premium proteins only when the budget allows it. Name turkey as 93% lean ground turkey unless the user explicitly asks for another cut. Use human-readable creator/source labels without @ handles in app output.`
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
                  'Create a complete meal plan and a selectable recipeLibrary of 25-50 sourced recipe options. Use web-discovered recipes and public recipe/social inspiration as source material, then summarize/adapt in original words. Do not create repeated template names like Lime Chili Protein Bowl or Garlic Herb Protein Plate. Recipe names should reflect the actual food and source concept. Use source nutrition/macros when available; otherwise estimate per-serving macros from ingredient amounts. Do not use the same calorie number for every recipe. Use calorieTarget as the per-meal target for one serving. dailyCalorieTarget is calorieTarget multiplied by selected meals per day, and cookedDailyCalorieTarget is further multiplied by servingsPerMeal; use those derived values only for planning scale, not for per-serving macro output. Use the groceryBudget preference before choosing recipes. Treat the budget as the full selected menu budget, then divide by days * selected meal slots to reason about budget per recipe. Low budgets should lean on lower-cost real recipes and staples. Higher budgets can include premium recipes like steak, salmon, shrimp, quinoa, and higher-cost vegetables. If pantryIngredients are provided, prefer recipes that naturally use those ingredients without forcing them into every meal. List every seasoning and sauce as its own measured ingredient using tbsp or tsp. Do not use vague ingredients like seasonings, spices, or sauce to taste.',
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
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error('OpenAI returned an empty meal plan.');
  }

  const plan = JSON.parse(outputText);
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
  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              'You identify visible pantry, fridge, freezer, and countertop food items from a user photo for a meal-planning app. Return only items that are reasonably visible or strongly implied by readable packaging. Do not invent hidden ingredients. Keep names grocery-friendly, concise, and singular where possible.'
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'Analyze this pantry/fridge photo. Return likely usable ingredients, identify any visible proteins separately, and include a short note if the photo is blurry, blocked, or missing obvious protein items. Confidence must be high, medium, or low.'
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
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error('OpenAI returned empty pantry photo analysis.');
  }

  const payload = JSON.parse(outputText);
  const ingredients = dedupeIngredientObjects(payload.ingredients || []);
  const proteins = dedupeStrings(payload.proteins || []);

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

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    input: [
      {
        role: 'developer',
        content: [
          {
            type: 'input_text',
            text:
              'You find real recipe ideas from the public web and selected public social recipe sources, then return original summaries for a pantry-first cooking app. Do not copy recipe pages, captions, or creator text. Every returned recipe must be built primarily around the user pantry ingredients. Optional additions must be small pantry staples only: measured dried spices, herbs, oil, citrus/vinegar, hot sauce, broth/water, salt, or pepper. Do not add specialty dairy, cheese sauces, cream sauces, cottage cheese, fresh cheeses, meat, seafood, or vegetables unless they are visible/typed pantry ingredients. Do not mash two unrelated recipes into one dish. A source link must match the same dish family as the returned recipe, not just share one ingredient. Macro numbers must be per serving. The calorieTarget input means target calories for this one meal serving, not a daily target. Return only valid JSON matching the schema.'
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
                  'Find and summarize real recipe options for the requested meal type using the provided pantry/fridge ingredients as the core. Use the web search tool. Return exactly recipeCount different recipes unless there are truly not enough coherent matches. Recipe names should be specific to the source-backed food concept, not generic flavor templates. Do not return recipes named in excludeRecipeNames. Include source links whose recipe concept directly matches each returned dish. For example, do not cite a mac and cheese recipe for a tomato penne recipe, and do not add four-cheese sauce to a tomato pasta unless cheese sauce is in the user pantry ingredients. Use source nutrition/macros when available; otherwise estimate per-serving macros from the returned ingredient amounts. List seasonings/sauces with tbsp/tsp measurements. Steps should be plain sentences without leading numbers.',
                recipeCount,
                mealType,
                pantryIngredients,
                excludeRecipeNames,
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

function normalizeGeneratedRecipe(recipe = {}, index, mealType) {
  const id = recipe.id || `pantry-sourced-${index + 1}`;
  return {
    ...recipe,
    id,
    optionKey: recipe.optionKey || id,
    mealType: recipe.mealType || mealType,
    time: recipe.time || defaultTime(mealType),
    macroRating: normalizeMacroRating(recipe.macroRating),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ingredient) => String(ingredient || '').trim()).filter(Boolean)
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.map(stripLeadingStepNumber).filter(Boolean)
      : [],
    sources: Array.isArray(recipe.sources)
      ? recipe.sources.filter((source) => source?.url && source?.label).slice(0, 3)
      : []
  };
}

function normalizeMacroRating(value = '') {
  const rating = String(value || '').trim().toUpperCase();
  if (rating.includes('SUPER')) return 'SUPER FIT';
  if (rating.includes('BALANCED')) return 'BALANCED';
  return 'FIT';
}

function stripLeadingStepNumber(value = '') {
  return String(value || '').trim().replace(/^\s*\d+[\).]\s*/, '');
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
    const name = String(item?.name || '').trim();
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
