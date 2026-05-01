import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { buildMealPlan, normalizePreferences } from './recipeEngine.js';
import { generateAiMealPlan } from './openaiPlanner.js';
import { CREATOR_SOURCES, SOURCE_POLICY_NOTES } from './sources.js';
import {
  attachGroceryEstimate,
  buildAssignedMealPlan,
  buildSelectedMealPlan,
  estimateSelectionPricing
} from './costEstimator.js';
import { attachRecipeLibrary } from './recipeLibrary.js';
import {
  buildPlanCacheKey,
  getCacheSettings,
  getCachedPlan,
  listCachedRecipes,
  setCachedPlan,
  stampUncachedResponse
} from './planCache.js';
import { confirmSignup, createSignup, deleteSignup } from './users.js';
import { buildPantryRecipes } from './pantryRecipes.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || '*';
const pendingAiPlans = new Map();

app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'CutPlate AI API',
    aiReady: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-5-nano',
    cache: getCacheSettings(),
    aiTimeoutMs: getAiTimeoutMs(),
    fastFirst: shouldReturnFastFirst(),
    webSearch: shouldUseWebSearch(),
    time: new Date().toISOString()
  });
});

app.get('/api/sources', (req, res) => {
  res.json({
    sources: CREATOR_SOURCES,
    notes: SOURCE_POLICY_NOTES
  });
});

app.get('/api/cached-recipes', async (req, res) => {
  const ingredients = String(req.query.ingredients || '')
    .split(',')
    .map((ingredient) => ingredient.trim())
    .filter(Boolean);
  const limit = Math.min(120, Math.max(1, Number(req.query.limit || 80)));

  res.json({
    recipes: await listCachedRecipes({ ingredients, limit })
  });
});

app.post('/api/signup', async (req, res, next) => {
  try {
    const signup = await createSignup(req.body || {});
    res.status(201).json({ ok: true, ...signup });
  } catch (error) {
    next(error);
  }
});

app.get('/api/confirm-email', async (req, res) => {
  const user = await confirmSignup(req.query.token);

  if (!user) {
    return res.status(400).send(buildEmailConfirmationPage({
      title: 'Confirmation link expired',
      message: 'Open CutPlate Cardinal and request a new confirmation email.'
    }));
  }

  return res.send(buildEmailConfirmationPage({
    title: 'Email confirmed',
    message: `Thanks, ${user.name}. You can return to CutPlate Cardinal.`
  }));
});

app.post('/api/delete-account', async (req, res, next) => {
  try {
    await deleteSignup(req.body?.email);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/pantry-recipes', (req, res, next) => {
  try {
    res.json(buildPantryRecipes(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post('/api/plan', async (req, res) => {
  const preferences = normalizePreferences(req.body);
  const cached = await getCachedPlan(preferences);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  if (cached && (!aiConfigured || cached.mode === 'ai')) {
    return res.json(cached);
  }

  if (aiConfigured) {
    const aiResponsePromise = getOrStartAiPlan(preferences);

    if (shouldReturnFastFirst()) {
      const localPlan = buildMealPlan(preferences);
      const localResponse = {
        plan: localPlan,
        warnings: ['Showing budget-aware starter recipes now. A richer creator-guided menu is being cached for these choices.'],
        mode: 'local'
      };
      return res.json(stampUncachedResponse(localResponse, preferences));
    }

    try {
      const aiResponse = await waitForRecipePlan(aiResponsePromise);
      return res.json(stampUncachedResponse(aiResponse, preferences));
    } catch (error) {
      return res.status(error?.code === 'ETIMEDOUT' ? 504 : 502).json({
        error: getAiPlanError(error),
        cache: {
          hit: false,
          key: buildPlanCacheKey(preferences),
          warming: true
        }
      });
    }
  }

  const localPlan = buildMealPlan(preferences);
  const localResponse = {
    plan: localPlan,
    warnings: ['Connected recipe gathering is not configured, so this plan used the local recipe engine.'],
    mode: 'local'
  };
  await setCachedPlan(preferences, localResponse);

  return res.json(stampUncachedResponse(localResponse, preferences));
});

app.post('/api/estimate', (req, res) => {
  const { plan, selectedMealIds = [], assignedMeals = [], preferences = {} } = req.body || {};

  if (!plan || !Array.isArray(plan.days)) {
    return res.status(400).json({ error: 'A plan with days is required.' });
  }

  const selectedPlan = Array.isArray(assignedMeals) && assignedMeals.length > 0
    ? buildAssignedMealPlan(plan, assignedMeals)
    : buildSelectedMealPlan(plan, selectedMealIds);
  const planWithEstimate = attachGroceryEstimate(selectedPlan, {
    ...(plan.preferences || {}),
    ...preferences
  });

  return res.json({ plan: planWithEstimate });
});

app.post('/api/menu-costs', (req, res) => {
  const { selectedMeals = [], optionMeals = [], preferences = {} } = req.body || {};

  if (!Array.isArray(selectedMeals) || !Array.isArray(optionMeals)) {
    return res.status(400).json({ error: 'selectedMeals and optionMeals must be arrays.' });
  }

  return res.json(estimateSelectionPricing({
    selectedMeals,
    optionMeals,
    preferences
  }));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong while building the plan.' });
});

app.listen(port, () => {
  console.log(`CutPlate AI API running on http://localhost:${port}`);
});

function getOrStartAiPlan(preferences) {
  const key = buildPlanCacheKey(preferences);
  const existing = pendingAiPlans.get(key);
  if (existing) return existing;

  const promise = buildAiPlanResponse(preferences)
    .then(async (response) => {
      await setCachedPlan(preferences, response);
      return response;
    })
    .finally(() => {
      pendingAiPlans.delete(key);
    });

  promise.catch(() => {});
  pendingAiPlans.set(key, promise);
  return promise;
}

async function buildAiPlanResponse(preferences) {
  const aiPlan = attachGroceryEstimate(attachRecipeLibrary(await generateAiMealPlan(preferences), preferences), preferences);
  return {
    plan: aiPlan,
    warnings: [],
    mode: 'ai'
  };
}

function waitForRecipePlan(promise) {
  const timeoutMs = getAiTimeoutMs();
  if (!timeoutMs) return promise;
  return withTimeout(promise, timeoutMs, 'Recipe gathering timed out');
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(message);
      error.code = 'ETIMEDOUT';
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function getAiTimeoutMs() {
  const rawValue = String(process.env.PLAN_AI_TIMEOUT_MS || '').trim();
  if (!rawValue) return null;

  const configured = Number(rawValue);
  return Number.isFinite(configured) && configured > 0 ? configured : null;
}

function shouldReturnFastFirst() {
  return /^(1|true|yes)$/i.test(String(process.env.PLAN_FAST_FIRST || 'false'));
}

function shouldUseWebSearch() {
  return /^(1|true|yes)$/i.test(String(process.env.PLAN_WEB_SEARCH || 'false'));
}

function getAiPlanError(error) {
  if (error?.code === 'ETIMEDOUT') {
    return 'Recipes are still being gathered and cached for these choices. Try Generate again in a moment.';
  }

  return `Recipe gathering failed: ${error.message}`;
}

function buildEmailConfirmationPage({ title, message }) {
  return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; margin: 0; background: #fff; color: #060606; }
          main { max-width: 520px; margin: 0 auto; padding: 64px 24px; }
          h1 { font-size: 42px; line-height: 1.05; margin: 0 0 16px; }
          p { color: #505050; font-size: 18px; line-height: 1.5; font-weight: 700; }
          .line { height: 4px; width: 100%; background: #c91f32; border-radius: 999px; margin-bottom: 32px; }
        </style>
      </head>
      <body>
        <main>
          <div class="line"></div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
        </main>
      </body>
    </html>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
