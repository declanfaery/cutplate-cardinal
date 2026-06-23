import { randomUUID } from 'node:crypto';
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.resolve(__dirname, '..', '.cache');
const analyticsPath = path.join(cacheDir, 'analytics-events.jsonl');
const { Pool } = pg;
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    })
  : null;

export function getAnalyticsSettings() {
  return {
    enabled: true,
    storage: pool ? 'database' : 'local-cache',
    summaryReady: Boolean(pool && String(process.env.ANALYTICS_ADMIN_KEY || '').trim())
  };
}

export async function trackAnalyticsEvent(input = {}) {
  const event = normalizeAnalyticsEvent(input);

  if (pool) {
    return insertDatabaseEvent(event);
  }

  await mkdir(cacheDir, { recursive: true });
  await appendFile(analyticsPath, `${JSON.stringify({ id: randomUUID(), createdAt: new Date().toISOString(), ...event })}\n`);
  return { ok: true, storage: 'local-cache' };
}

export async function getAnalyticsSummary({ days = 30, client = pool } = {}) {
  if (!client) {
    const error = new Error('Analytics summaries require DATABASE_URL.');
    error.status = 503;
    throw error;
  }

  const windowDays = normalizeAnalyticsWindow(days);
  const { rows } = await client.query(
    `with identified_events as (
       select
         created_at,
         event_name,
         properties,
         coalesce(
           nullif(anonymous_id, ''),
           nullif(user_id, ''),
           nullif(email, '')
         ) as identity_key
       from public.analytics_events
       where coalesce(platform, '') not in ('manual', 'test')
     ),
     valid_events as (
       select *
       from identified_events
       where identity_key is not null
     ),
     first_opens as (
       select identity_key, min(created_at) as first_opened_at
       from valid_events
       where event_name = 'app_opened'
       group by identity_key
     ),
     d7_eligible as (
       select identity_key, first_opened_at
       from first_opens
       where first_opened_at <= now() - interval '14 days'
     ),
     d7_retained as (
       select distinct eligible.identity_key
       from d7_eligible eligible
       join valid_events event
         on event.identity_key = eligible.identity_key
        and event.event_name = 'app_opened'
        and event.created_at >= eligible.first_opened_at + interval '7 days'
        and event.created_at < eligible.first_opened_at + interval '14 days'
     ),
     planning_weeks as (
       select
         identity_key,
         date_trunc('week', created_at) as planning_week
       from valid_events
       where event_name = 'meal_plan_generated'
         and created_at >= now() - make_interval(days => $1)
       group by identity_key, date_trunc('week', created_at)
     ),
     repeat_weekly_planners as (
       select identity_key
       from planning_weeks
       group by identity_key
       having count(*) >= 2
     ),
     top_markets as (
       select properties->>'coarseMarket' as name, count(*) as count
       from valid_events
       where created_at >= now() - make_interval(days => $1)
         and nullif(properties->>'coarseMarket', '') is not null
       group by properties->>'coarseMarket'
       order by count(*) desc
       limit 10
     ),
     top_selected_proteins as (
       select properties->>'protein' as name, count(*) as count
       from valid_events
       where event_name = 'recipe_selection_changed'
         and properties->>'action' = 'selected'
         and created_at >= now() - make_interval(days => $1)
         and nullif(properties->>'protein', '') is not null
       group by properties->>'protein'
       order by count(*) desc
       limit 10
     ),
     top_deselected_proteins as (
       select properties->>'protein' as name, count(*) as count
       from valid_events
       where event_name = 'recipe_selection_changed'
         and properties->>'action' = 'deselected'
         and created_at >= now() - make_interval(days => $1)
         and nullif(properties->>'protein', '') is not null
       group by properties->>'protein'
       order by count(*) desc
       limit 10
     ),
     top_saved_proteins as (
       select properties->>'protein' as name, count(*) as count
       from valid_events
       where event_name = 'recipe_saved'
         and created_at >= now() - make_interval(days => $1)
         and nullif(properties->>'protein', '') is not null
       group by properties->>'protein'
       order by count(*) desc
       limit 10
     ),
     top_screens as (
       select properties->>'name' as name, count(*) as count
       from valid_events
       where event_name = 'screen_viewed'
         and created_at >= now() - make_interval(days => $1)
         and nullif(properties->>'name', '') is not null
       group by properties->>'name'
       order by count(*) desc
       limit 20
     )
     select
       now() as generated_at,
       (select count(distinct identity_key) from valid_events where event_name = 'app_opened') as all_time_users,
       (select count(distinct identity_key) from valid_events where event_name = 'app_opened' and created_at >= now() - interval '7 days') as weekly_active_users,
       (select count(distinct identity_key) from valid_events where event_name = 'app_opened' and created_at >= now() - interval '30 days') as monthly_active_users,
       (select count(*) from first_opens where first_opened_at >= now() - make_interval(days => $1)) as new_users_in_window,
       (select count(*) from valid_events where event_name = 'app_opened' and created_at >= now() - make_interval(days => $1)) as app_opens_in_window,
       (select count(*) from valid_events where event_name = 'session_ended' and created_at >= now() - make_interval(days => $1)) as sessions_in_window,
       (select avg(case when properties->>'durationMs' ~ '^\\d+$' then (properties->>'durationMs')::numeric end) from valid_events where event_name = 'session_ended' and created_at >= now() - make_interval(days => $1)) as average_session_duration_ms,
       (select count(*) from valid_events where event_name = 'screen_viewed' and created_at >= now() - make_interval(days => $1)) as screen_views,
       (select count(*) from valid_events where event_name = 'meal_plan_started' and created_at >= now() - make_interval(days => $1)) as meal_plans_started,
       (select count(*) from valid_events where event_name = 'meal_plan_generated') as meal_plans_generated_all_time,
       (select count(*) from valid_events where event_name = 'meal_plan_generated' and created_at >= now() - make_interval(days => $1)) as meal_plans_generated,
       (select count(*) from valid_events where event_name = 'menu_selected' and created_at >= now() - make_interval(days => $1)) as shopping_lists_created,
       (select count(*) from valid_events where event_name = 'grocery_list_viewed' and created_at >= now() - make_interval(days => $1)) as shopping_lists_viewed,
       (select count(*) from valid_events where event_name = 'recipe_saved' and created_at >= now() - make_interval(days => $1)) as recipes_saved,
       (select count(*) from valid_events where event_name = 'pantry_photo_scanned' and properties->>'status' = 'detected' and created_at >= now() - make_interval(days => $1)) as pantry_scans,
       (select count(*) from valid_events where event_name = 'pantry_photo_scanned' and created_at >= now() - make_interval(days => $1)) as pantry_scan_attempts,
       (select avg(case when properties->>'detectedCount' ~ '^\\d+$' then (properties->>'detectedCount')::numeric end) from valid_events where event_name = 'pantry_photo_scanned' and properties->>'status' = 'detected' and created_at >= now() - make_interval(days => $1)) as average_pantry_detected_count,
       (select avg(case when properties->>'durationMs' ~ '^\\d+$' then (properties->>'durationMs')::numeric end) from valid_events where event_name = 'pantry_photo_scanned' and created_at >= now() - make_interval(days => $1)) as average_pantry_scan_duration_ms,
       (select count(*) from valid_events where event_name = 'pantry_scan_confirmed' and created_at >= now() - make_interval(days => $1)) as pantry_confirmed_scans,
       (select avg(case when properties->>'correctionRatePct' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'correctionRatePct')::numeric end) from valid_events where event_name = 'pantry_scan_confirmed' and created_at >= now() - make_interval(days => $1)) as average_pantry_correction_rate,
       (select avg(case when properties->>'userAddedCount' ~ '^\\d+$' then (properties->>'userAddedCount')::numeric end) from valid_events where event_name = 'pantry_scan_confirmed' and created_at >= now() - make_interval(days => $1)) as average_pantry_user_added_count,
       (select avg(case when properties->>'removedCount' ~ '^\\d+$' then (properties->>'removedCount')::numeric end) from valid_events where event_name = 'pantry_scan_confirmed' and created_at >= now() - make_interval(days => $1)) as average_pantry_removed_count,
       (select count(*) from valid_events where event_name = 'pantry_recipes_generated' and created_at >= now() - make_interval(days => $1)) as pantry_recipe_sessions,
       (select count(*) from valid_events where event_name in ('calendar_plan_added', 'calendar_meal_added') and created_at >= now() - make_interval(days => $1)) as calendar_adds,
       (select count(*) from valid_events where event_name = 'recipe_selection_changed' and properties->>'action' = 'selected' and created_at >= now() - make_interval(days => $1)) as recipe_selections,
       (select count(*) from valid_events where event_name = 'recipe_selection_changed' and properties->>'action' = 'deselected' and created_at >= now() - make_interval(days => $1)) as recipe_deselections,
       (select count(*) from valid_events where event_name = 'recipe_selection_blocked' and created_at >= now() - make_interval(days => $1)) as recipe_selection_blocks,
       (select count(*) from valid_events where event_name = 'recipe_swapped' and created_at >= now() - make_interval(days => $1)) as recipe_swaps,
       (select count(*) from valid_events where event_name = 'recipe_source_opened' and created_at >= now() - make_interval(days => $1)) as recipe_source_opens,
       (select count(*) from valid_events where event_name = 'recipe_repeated' and created_at >= now() - make_interval(days => $1)) as recipe_repeats,
       (select coalesce(sum(
         case
           when event_name = 'meal_plan_generated' and properties->>'optionCount' ~ '^\\d+$' then (properties->>'optionCount')::bigint
           when event_name = 'meal_options_more_generated' and properties->>'added' ~ '^\\d+$' then (properties->>'added')::bigint
           when event_name in ('pantry_recipes_generated', 'pantry_recipes_more_generated') and properties->>'count' ~ '^\\d+$' then (properties->>'count')::bigint
           else 0
         end
       ), 0) from valid_events where created_at >= now() - make_interval(days => $1)) as recipe_impressions,
       (select count(*) from valid_events where event_name = 'meal_options_more_requested' and created_at >= now() - make_interval(days => $1)) as more_options_requests,
       (select count(*) from valid_events where event_name = 'meal_options_more_generated' and created_at >= now() - make_interval(days => $1)) as more_options_successes,
       (select count(*) from valid_events where event_name = 'meal_plan_failed' and created_at >= now() - make_interval(days => $1)) as meal_plan_failures,
       (select count(*) from valid_events where event_name = 'pantry_recipes_failed' and created_at >= now() - make_interval(days => $1)) as pantry_recipe_failures,
       (select count(*) from valid_events where event_name = 'menu_selected' and properties->>'overBudget' = 'true' and created_at >= now() - make_interval(days => $1)) as over_budget_menus,
       (select avg(case when properties->>'budgetUtilizationPct' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'budgetUtilizationPct')::numeric end) from valid_events where event_name = 'menu_selected' and created_at >= now() - make_interval(days => $1)) as average_budget_utilization,
       (select count(*) from valid_events where event_name = 'menu_pricing_updated' and created_at >= now() - make_interval(days => $1)) as menu_pricing_evaluations,
       (select avg(
         case
           when properties->>'affordableOptionCount' ~ '^\\d+$'
            and properties->>'pricedOptionCount' ~ '^[1-9]\\d*$'
           then ((properties->>'affordableOptionCount')::numeric / (properties->>'pricedOptionCount')::numeric) * 100
         end
       ) from valid_events where event_name = 'menu_pricing_updated' and created_at >= now() - make_interval(days => $1)) as average_affordable_option_rate,
       (select avg(case when properties->>'medianMarginalCost' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'medianMarginalCost')::numeric end) from valid_events where event_name = 'menu_pricing_updated' and created_at >= now() - make_interval(days => $1)) as average_marginal_cost,
       (select count(*) from valid_events where event_name in ('meal_plan_generated', 'pantry_recipes_generated', 'pantry_recipes_more_generated') and created_at >= now() - make_interval(days => $1)) as generation_sessions,
       (select count(*) from valid_events where event_name in ('meal_plan_generated', 'pantry_recipes_generated', 'pantry_recipes_more_generated') and properties->>'cacheHit' = 'true' and created_at >= now() - make_interval(days => $1)) as cache_hit_sessions,
       (select count(*) from valid_events where event_name = 'grocery_estimate_feedback' and created_at >= now() - make_interval(days => $1)) as grocery_feedback_responses,
       (select count(*) from valid_events where event_name = 'grocery_estimate_feedback' and properties->>'rating' = 'too_low' and created_at >= now() - make_interval(days => $1)) as grocery_feedback_too_low,
       (select count(*) from valid_events where event_name = 'grocery_estimate_feedback' and properties->>'rating' = 'close' and created_at >= now() - make_interval(days => $1)) as grocery_feedback_close,
       (select count(*) from valid_events where event_name = 'grocery_estimate_feedback' and properties->>'rating' = 'too_high' and created_at >= now() - make_interval(days => $1)) as grocery_feedback_too_high,
       (select avg(case when properties->>'errorPct' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'errorPct')::numeric end) from valid_events where event_name = 'grocery_estimate_feedback' and created_at >= now() - make_interval(days => $1)) as average_grocery_error_pct,
       (select avg(case when properties->>'errorPct' ~ '^-?[0-9]+(\\.[0-9]+)?$' then abs((properties->>'errorPct')::numeric) end) from valid_events where event_name = 'grocery_estimate_feedback' and created_at >= now() - make_interval(days => $1)) as average_grocery_absolute_error_pct,
       (select coalesce(sum(case when properties->>'actualTotal' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'actualTotal')::numeric else 0 end), 0) from valid_events where event_name = 'grocery_estimate_feedback' and created_at >= now() - make_interval(days => $1)) as actual_grocery_spend_captured,
       (select count(*) from valid_events where event_name = 'ai_request_completed' and created_at >= now() - make_interval(days => $1)) as ai_requests,
       (select count(*) from valid_events where event_name = 'ai_request_failed' and created_at >= now() - make_interval(days => $1)) as ai_failures,
       (select coalesce(sum(case when properties->>'inputTokens' ~ '^\\d+$' then (properties->>'inputTokens')::bigint else 0 end), 0) from valid_events where event_name = 'ai_request_completed' and created_at >= now() - make_interval(days => $1)) as ai_input_tokens,
       (select coalesce(sum(case when properties->>'outputTokens' ~ '^\\d+$' then (properties->>'outputTokens')::bigint else 0 end), 0) from valid_events where event_name = 'ai_request_completed' and created_at >= now() - make_interval(days => $1)) as ai_output_tokens,
       (select coalesce(sum(case when properties->>'estimatedCostUsd' ~ '^-?[0-9]+(\\.[0-9]+)?$' then (properties->>'estimatedCostUsd')::numeric else 0 end), 0) from valid_events where event_name = 'ai_request_completed' and created_at >= now() - make_interval(days => $1)) as ai_estimated_cost,
       (select avg(case when properties->>'durationMs' ~ '^\\d+$' then (properties->>'durationMs')::numeric end) from valid_events where event_name = 'ai_request_completed' and created_at >= now() - make_interval(days => $1)) as ai_average_latency_ms,
       (select coalesce(jsonb_object_agg(name, count), '{}'::jsonb) from top_markets) as top_markets,
       (select coalesce(jsonb_object_agg(name, count), '{}'::jsonb) from top_selected_proteins) as top_selected_proteins,
       (select coalesce(jsonb_object_agg(name, count), '{}'::jsonb) from top_deselected_proteins) as top_deselected_proteins,
       (select coalesce(jsonb_object_agg(name, count), '{}'::jsonb) from top_saved_proteins) as top_saved_proteins,
       (select coalesce(jsonb_object_agg(name, count), '{}'::jsonb) from top_screens) as top_screens,
       (select count(*) from repeat_weekly_planners) as repeat_weekly_planners,
       (select count(*) from d7_eligible) as d7_eligible_users,
       (select count(*) from d7_retained) as d7_retained_users`,
    [windowDays]
  );

  return formatAnalyticsSummary(rows[0] || {}, windowDays);
}

async function insertDatabaseEvent(event) {
  try {
    await pool.query(
      `insert into public.analytics_events (
          user_id,
          email,
          anonymous_id,
          event_name,
          properties,
          app_version,
          platform
        )
        values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        event.userId,
        event.email,
        event.anonymousId,
        event.eventName,
        event.properties,
        event.appVersion,
        event.platform
      ]
    );
    return { ok: true, storage: 'database' };
  } catch (error) {
    if (error?.code !== '42703') {
      throw error;
    }

    await pool.query(
      `insert into public.analytics_events (
          user_id,
          email,
          anonymous_id,
          event_name
        )
        values ($1, $2, $3, $4)`,
      [event.userId, event.email, event.anonymousId, event.eventName]
    );
    return { ok: true, storage: 'database', schema: 'basic' };
  }
}

export function normalizeAnalyticsWindow(value) {
  const parsed = Number.parseInt(String(value || 30), 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(3650, Math.max(1, parsed));
}

export function formatAnalyticsSummary(row = {}, windowDays = 30) {
  const eligibleUsers = toNumber(row.d7_eligible_users);
  const retainedUsers = toNumber(row.d7_retained_users);
  const mealPlansStarted = toNumber(row.meal_plans_started);
  const mealPlansGenerated = toNumber(row.meal_plans_generated);
  const menusSelected = toNumber(row.shopping_lists_created);
  const pantryScanAttempts = toNumber(row.pantry_scan_attempts);
  const pantryScans = toNumber(row.pantry_scans);
  const recipeImpressions = toNumber(row.recipe_impressions);
  const recipeSelections = toNumber(row.recipe_selections);
  const recipesSaved = toNumber(row.recipes_saved);
  const pricingEvaluations = toNumber(row.menu_pricing_evaluations);
  const feedbackResponses = toNumber(row.grocery_feedback_responses);
  const aiRequests = toNumber(row.ai_requests);
  const aiEstimatedCost = toNumber(row.ai_estimated_cost);
  const activeUsers = toNumber(row.monthly_active_users);

  return {
    generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : new Date().toISOString(),
    windowDays,
    users: {
      allTime: toNumber(row.all_time_users),
      active7d: toNumber(row.weekly_active_users),
      active30d: toNumber(row.monthly_active_users),
      newInWindow: toNumber(row.new_users_in_window)
    },
    activity: {
      appOpens: toNumber(row.app_opens_in_window),
      sessions: toNumber(row.sessions_in_window),
      averageSessionMinutes: nullableMinutes(row.average_session_duration_ms),
      screenViews: toNumber(row.screen_views),
      mealPlansStarted,
      mealPlansGenerated,
      mealPlansGeneratedAllTime: toNumber(row.meal_plans_generated_all_time),
      shoppingListsCreated: toNumber(row.shopping_lists_created),
      shoppingListsViewed: toNumber(row.shopping_lists_viewed),
      recipesSaved: toNumber(row.recipes_saved),
      pantryScans,
      pantryScanAttempts,
      pantryRecipeSessions: toNumber(row.pantry_recipe_sessions),
      calendarAdds: toNumber(row.calendar_adds),
      recipeSelections: toNumber(row.recipe_selections),
      recipeDeselections: toNumber(row.recipe_deselections),
      recipeSelectionBlocks: toNumber(row.recipe_selection_blocks),
      recipeSwaps: toNumber(row.recipe_swaps),
      recipeSourceOpens: toNumber(row.recipe_source_opens),
      moreOptionsRequests: toNumber(row.more_options_requests)
    },
    funnel: {
      planStartToGeneratedRate: rate(mealPlansGenerated, mealPlansStarted),
      generatedToMenuSelectedRate: rate(menusSelected, mealPlansGenerated),
      pantryScanSuccessRate: rate(pantryScans, pantryScanAttempts),
      moreOptionsSuccessRate: rate(
        toNumber(row.more_options_successes),
        toNumber(row.more_options_requests)
      ),
      mealPlanFailures: toNumber(row.meal_plan_failures),
      pantryRecipeFailures: toNumber(row.pantry_recipe_failures)
    },
    budget: {
      overBudgetMenus: toNumber(row.over_budget_menus),
      averageUtilizationPct: nullableNumber(row.average_budget_utilization),
      pricingEvaluations,
      averageAffordableOptionRatePct: nullableNumber(row.average_affordable_option_rate),
      averageMarginalCost: nullableMoney(row.average_marginal_cost)
    },
    pantryIntelligence: {
      successfulScans: pantryScans,
      scanAttempts: pantryScanAttempts,
      confirmedScans: toNumber(row.pantry_confirmed_scans),
      averageDetectedIngredients: nullableNumber(row.average_pantry_detected_count),
      averageScanLatencyMs: nullableRoundedNumber(row.average_pantry_scan_duration_ms),
      averageCorrectionRatePct: nullableNumber(row.average_pantry_correction_rate),
      averageUserAddedIngredients: nullableNumber(row.average_pantry_user_added_count),
      averageRemovedIngredients: nullableNumber(row.average_pantry_removed_count)
    },
    preferenceLearning: {
      recipeImpressions,
      recipeSelections,
      recipeDeselections: toNumber(row.recipe_deselections),
      recipesSaved,
      recipeRepeats: toNumber(row.recipe_repeats),
      selectionRatePct: rate(recipeSelections, recipeImpressions),
      saveRatePct: rate(recipesSaved, recipeSelections),
      topSelectedProteins: cleanCountObject(row.top_selected_proteins),
      topDeselectedProteins: cleanCountObject(row.top_deselected_proteins),
      topSavedProteins: cleanCountObject(row.top_saved_proteins)
    },
    groceryPriceIntelligence: {
      feedbackResponses,
      tooLow: toNumber(row.grocery_feedback_too_low),
      close: toNumber(row.grocery_feedback_close),
      tooHigh: toNumber(row.grocery_feedback_too_high),
      closeRatePct: rate(toNumber(row.grocery_feedback_close), feedbackResponses),
      averageSignedErrorPct: nullableNumber(row.average_grocery_error_pct),
      averageAbsoluteErrorPct: nullableNumber(row.average_grocery_absolute_error_pct),
      actualSpendCaptured: nullableMoney(row.actual_grocery_spend_captured),
      topMarkets: cleanCountObject(row.top_markets)
    },
    recipeCache: {
      generationSessions: toNumber(row.generation_sessions),
      cacheHitSessions: toNumber(row.cache_hit_sessions),
      cacheHitRatePct: rate(
        toNumber(row.cache_hit_sessions),
        toNumber(row.generation_sessions)
      )
    },
    ai: {
      requests: aiRequests,
      failures: toNumber(row.ai_failures),
      inputTokens: toNumber(row.ai_input_tokens),
      outputTokens: toNumber(row.ai_output_tokens),
      estimatedCostUsd: Number(aiEstimatedCost.toFixed(4)),
      averageLatencyMs: nullableRoundedNumber(row.ai_average_latency_ms),
      estimatedCostPerActiveUserUsd: activeUsers > 0
        ? Number((aiEstimatedCost / activeUsers).toFixed(4))
        : null
    },
    learningSignals: {
      topMarkets: cleanCountObject(row.top_markets),
      topSelectedProteins: cleanCountObject(row.top_selected_proteins),
      topDeselectedProteins: cleanCountObject(row.top_deselected_proteins),
      topSavedProteins: cleanCountObject(row.top_saved_proteins),
      topScreens: cleanCountObject(row.top_screens)
    },
    retention: {
      repeatWeeklyPlanners: toNumber(row.repeat_weekly_planners),
      d7EligibleUsers: eligibleUsers,
      d7RetainedUsers: retainedUsers,
      d7RetentionRate: eligibleUsers > 0
        ? Number(((retainedUsers / eligibleUsers) * 100).toFixed(1))
        : null
    },
    definitions: {
      user: 'A unique anonymous installation ID, with account ID or email used only as a fallback.',
      shoppingListCreated: 'A completed menu selection, which creates the selected-plan grocery estimate.',
      d7Retention: 'Users who opened the app 7-13 days after their first recorded app open.',
      estimatedAiCost: 'Calculated only when current per-million-token rates are configured on the API.',
      pantryCorrectionRate: 'User additions and removals divided by ingredients detected in the pantry photo.',
      affordableOptionRate: 'Recipe options whose projected total remains within the stated grocery budget.',
      groceryEstimateError: 'Difference between estimated and user-reported checkout totals; feedback is optional.',
      recipeImpression: 'A generated recipe option shown in initial or additional meal and pantry results.'
    }
  };
}

function normalizeAnalyticsEvent(input = {}) {
  const eventName = String(input.eventName || input.event_name || '').trim().toLowerCase();
  if (!/^[a-z0-9_:-]{1,80}$/.test(eventName)) {
    const error = new Error('A valid event_name is required.');
    error.status = 400;
    throw error;
  }

  return {
    userId: cleanText(input.userId || input.user_id, 120),
    email: cleanEmail(input.email),
    anonymousId: cleanText(input.anonymousId || input.anonymous_id, 120),
    eventName,
    properties: cleanProperties(input.properties),
    appVersion: cleanText(input.appVersion || input.app_version, 40),
    platform: cleanText(input.platform, 40)
  };
}

function cleanText(value, maxLength) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 240) : null;
}

function cleanProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  try {
    const json = JSON.stringify(value);
    if (json.length > 12000) {
      return {
        truncated: true,
        originalSize: json.length
      };
    }
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(1)) : null;
}

function nullableRoundedNumber(value) {
  const number = nullableNumber(value);
  return number === null ? null : Math.round(number);
}

function nullableMinutes(value) {
  const milliseconds = nullableNumber(value);
  return milliseconds === null ? null : Number((milliseconds / 60000).toFixed(1));
}

function nullableMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function rate(numerator, denominator) {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function cleanCountObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [String(key), toNumber(count)])
      .filter(([key]) => key)
  );
}
