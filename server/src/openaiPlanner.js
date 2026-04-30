import OpenAI from 'openai';
import { SOURCE_POLICY_NOTES, getSourceSeeds } from './sources.js';
import { normalizePreferences } from './recipeEngine.js';

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'days', 'shoppingList', 'sourceNotes', 'safetyNote'],
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
            items: {
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
            }
          }
        }
      }
    },
    shoppingList: { type: 'array', items: { type: 'string' } },
    sourceNotes: { type: 'array', items: { type: 'string' } },
    safetyNote: { type: 'string' }
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
    ? `${useWebSearch ? 'Use web search for inspiration and source discovery,' : 'Use the provided social recipe seeds for style and discovery context,'} but do not copy creator captions, recipes, or post text.`
    : 'Use general healthy recipe knowledge and do not copy creator captions, recipes, or post text.';
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
                  'Create a complete meal plan with recipes, ingredients, steps, estimated per-serving macros, source links, and shopping list. Calories should usually be 300-520 for breakfast, 380-620 for lunch, 430-680 for dinner, and 140-320 for snacks. Protein should usually be 25-60g for meals and 15-32g for snacks. Use the groceryBudget preference before choosing recipes. Treat the budget as the full selected menu budget, then divide by days * selected meal slots to reason about budget per recipe. Low budgets under about $7 per recipe should lean on 93% lean ground turkey, chicken thighs, eggs, pasta, rice, beans, and frozen vegetables. Higher budgets around $10+ per recipe can and should include some premium choices like steak, salmon, shrimp, quinoa, and higher-cost vegetables. If pantryIngredients are provided, prefer recipes that naturally use those ingredients without forcing them into every meal. List every seasoning and sauce as its own measured ingredient using tbsp or tsp, for example 1 tbsp lime juice, 1/2 tsp chili powder, 1/4 tsp kosher salt, and 1/4 tsp black pepper. Do not use vague ingredients like seasonings, spices, or sauce to taste.',
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
    ...(useWebSearch ? { tools: [{ type: 'web_search_preview', search_context_size: 'low' }] } : {}),
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

function shouldUseWebSearch() {
  return /^(1|true|yes)$/i.test(String(process.env.PLAN_WEB_SEARCH || 'false'));
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
