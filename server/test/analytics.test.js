import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAnalyticsSummary,
  getAnalyticsSummary,
  normalizeAnalyticsWindow,
  trackAnalyticsEvent
} from '../src/analytics.js';

test('trackAnalyticsEvent stores a valid event', async () => {
  const result = await trackAnalyticsEvent({
    eventName: 'app_opened',
    anonymousId: 'test-anonymous-user',
    platform: 'test',
    appVersion: '0.0.0',
    properties: {
      source: 'node-test'
    }
  });

  assert.equal(result.ok, true);
  assert.match(result.storage, /^(database|local-cache)$/);
});

test('trackAnalyticsEvent rejects invalid event names', async () => {
  await assert.rejects(
    () => trackAnalyticsEvent({ eventName: 'bad event name' }),
    /valid event_name/
  );
});

test('normalizeAnalyticsWindow keeps report ranges bounded', () => {
  assert.equal(normalizeAnalyticsWindow('7'), 7);
  assert.equal(normalizeAnalyticsWindow('0'), 1);
  assert.equal(normalizeAnalyticsWindow('99999'), 3650);
  assert.equal(normalizeAnalyticsWindow('not-a-number'), 30);
});

test('formatAnalyticsSummary returns pitch-deck metrics', () => {
  const summary = formatAnalyticsSummary({
    generated_at: '2026-06-23T12:00:00.000Z',
    all_time_users: '50',
    weekly_active_users: '12',
    monthly_active_users: '31',
    new_users_in_window: '9',
    app_opens_in_window: '72',
    sessions_in_window: '20',
    average_session_duration_ms: '375000',
    screen_views: '180',
    meal_plans_started: '18',
    meal_plans_generated: '14',
    meal_plans_generated_all_time: '44',
    shopping_lists_created: '11',
    shopping_lists_viewed: '8',
    recipes_saved: '6',
    pantry_scans: '5',
    pantry_scan_attempts: '8',
    average_pantry_detected_count: '9.4',
    average_pantry_scan_duration_ms: '8900',
    pantry_confirmed_scans: '4',
    average_pantry_correction_rate: '23.75',
    average_pantry_user_added_count: '1.5',
    average_pantry_removed_count: '0.75',
    pantry_recipe_sessions: '4',
    calendar_adds: '7',
    recipe_selections: '22',
    recipe_deselections: '3',
    recipe_repeats: '5',
    recipe_impressions: '110',
    recipe_selection_blocks: '1',
    more_options_requests: '4',
    more_options_successes: '3',
    meal_plan_failures: '2',
    pantry_recipe_failures: '1',
    over_budget_menus: '2',
    average_budget_utilization: '91.35',
    menu_pricing_evaluations: '12',
    average_affordable_option_rate: '68.75',
    average_marginal_cost: '8.39',
    generation_sessions: '20',
    cache_hit_sessions: '13',
    grocery_feedback_responses: '8',
    grocery_feedback_too_low: '2',
    grocery_feedback_close: '5',
    grocery_feedback_too_high: '1',
    average_grocery_error_pct: '-3.25',
    average_grocery_absolute_error_pct: '8.75',
    actual_grocery_spend_captured: '512.49',
    ai_requests: '10',
    ai_failures: '1',
    ai_input_tokens: '12000',
    ai_output_tokens: '4000',
    ai_estimated_cost: '1.25',
    ai_average_latency_ms: '24500',
    top_markets: { 'us-nyc': 8, 'us-western-ny': 3 },
    top_selected_proteins: { chicken: 10, salmon: 4 },
    top_deselected_proteins: { tofu: 3 },
    top_saved_proteins: { salmon: 3, chicken: 2 },
    top_screens: { home: 40, menu_builder: 21 },
    repeat_weekly_planners: '4',
    d7_eligible_users: '20',
    d7_retained_users: '5'
  }, 30);

  assert.equal(summary.users.allTime, 50);
  assert.equal(summary.users.active7d, 12);
  assert.equal(summary.activity.mealPlansGenerated, 14);
  assert.equal(summary.activity.shoppingListsCreated, 11);
  assert.equal(summary.activity.averageSessionMinutes, 6.3);
  assert.equal(summary.funnel.planStartToGeneratedRate, 77.8);
  assert.equal(summary.funnel.pantryScanSuccessRate, 62.5);
  assert.equal(summary.pantryIntelligence.averageCorrectionRatePct, 23.8);
  assert.equal(summary.preferenceLearning.selectionRatePct, 20);
  assert.equal(summary.preferenceLearning.saveRatePct, 27.3);
  assert.equal(summary.preferenceLearning.recipeRepeats, 5);
  assert.equal(summary.budget.averageAffordableOptionRatePct, 68.8);
  assert.equal(summary.groceryPriceIntelligence.closeRatePct, 62.5);
  assert.equal(summary.groceryPriceIntelligence.averageAbsoluteErrorPct, 8.8);
  assert.equal(summary.recipeCache.cacheHitRatePct, 65);
  assert.equal(summary.ai.estimatedCostPerActiveUserUsd, 0.0403);
  assert.equal(summary.learningSignals.topSelectedProteins.chicken, 10);
  assert.equal(summary.learningSignals.topScreens.home, 40);
  assert.equal(summary.retention.d7RetentionRate, 25);
});

test('getAnalyticsSummary queries aggregate database metrics', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          generated_at: '2026-06-23T12:00:00.000Z',
          all_time_users: '3',
          weekly_active_users: '2'
        }]
      };
    }
  };

  const summary = await getAnalyticsSummary({ days: 14, client });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [14]);
  assert.match(calls[0].sql, /meal_plans_generated_all_time/);
  assert.match(calls[0].sql, /average_pantry_correction_rate/);
  assert.match(calls[0].sql, /grocery_feedback_responses/);
  assert.equal(summary.windowDays, 14);
  assert.equal(summary.users.allTime, 3);
});
