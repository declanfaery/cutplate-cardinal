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
              `You create original, health-focused weight-loss meal plans. ${discoveryInstruction} Return only valid JSON matching the schema. Macro numbers must be realistic per-serving estimates, not full-recipe totals and not medical claims. Never put serving counts in recipe names. Respect the user grocery budget by using cheaper staples for low budgets and more premium proteins only when the budget allows it. Name turkey as 93% lean ground turkey unless the user explicitly asks for another cut. Use human-readable creator/source labels without @ handles in app output.`
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
                  'Create a complete meal plan and a selectable recipeLibrary of 25-50 sourced recipe options. Use web-discovered recipes and public recipe/social inspiration as source material, then summarize/adapt in original words. Do not create repeated template names like Lime Chili Protein Bowl or Garlic Herb Protein Plate. Recipe names should reflect the actual food and source concept. Use source nutrition/macros when available; otherwise estimate per-serving macros from ingredient amounts. Do not use the same calorie number for every recipe. Use the groceryBudget preference before choosing recipes. Treat the budget as the full selected menu budget, then divide by days * selected meal slots to reason about budget per recipe. Low budgets should lean on lower-cost real recipes and staples. Higher budgets can include premium recipes like steak, salmon, shrimp, quinoa, and higher-cost vegetables. If pantryIngredients are provided, prefer recipes that naturally use those ingredients without forcing them into every meal. List every seasoning and sauce as its own measured ingredient using tbsp or tsp. Do not use vague ingredients like seasonings, spices, or sauce to taste.',
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

export async function generateSourcedPantryRecipes(input = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mealType = String(input.mealType || 'Dinner').trim() || 'Dinner';
  const pantryIngredients = String(input.ingredients || input.pantryIngredients || '').trim();
  const sourceSeeds = getSourceSeeds(input.sourceHandles || []);

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
              'You find real recipe ideas from the public web and selected public social recipe sources, then return original summaries for a pantry-first cooking app. Do not copy recipe pages, captions, or creator text. Every returned recipe must be built primarily around the user pantry ingredients, with only small pantry-staple additions like measured spices, citrus, sauces, or salt/pepper. Return only valid JSON matching the schema.'
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
                  'Find and summarize real recipe options for the requested meal type using the provided pantry/fridge ingredients as the core. Use the web search tool. The recipe names should be specific to the ingredient combination, not generic flavor templates. Include source links for each recipe. Use source nutrition/macros when available; otherwise estimate per-serving macros from the returned ingredient amounts. List seasonings/sauces with tbsp/tsp measurements.',
                mealType,
                pantryIngredients,
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
    recipes: payload.recipes.map((recipe, index) => ({
      ...recipe,
      id: recipe.id || `pantry-sourced-${index + 1}`,
      optionKey: recipe.optionKey || recipe.id || `pantry-sourced-${index + 1}`,
      mealType: recipe.mealType || mealType,
      time: recipe.time || defaultTime(mealType)
    }))
  };
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
