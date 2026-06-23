# CutPlate Analytics

The mobile app already sends product events to `public.analytics_events`. The
backend can aggregate those rows into pitch-deck and operating metrics without
exposing user emails or raw event data.

## Metrics

- `users.allTime`: unique installations that have opened the app.
- `users.active7d`: unique installations that opened the app in the last 7 days.
- `users.active30d`: unique installations that opened the app in the last 30 days.
- `activity.mealPlansGenerated`: generated plans during the requested window.
- `activity.shoppingListsCreated`: selected menus during the requested window.
- `activity.shoppingListsViewed`: grocery-list screen views during the window.
- `activity.recipesSaved`: recipes saved during the window.
- `activity.pantryScans`: successful pantry-photo scans during the window.
- `activity.averageSessionMinutes`: average foreground session length.
- `learningSignals.topScreens`: screen-view counts for funnel and drop-off analysis.
- `funnel.planStartToGeneratedRate`: completed plans divided by plan starts.
- `funnel.generatedToMenuSelectedRate`: selected menus divided by completed plans.
- `funnel.pantryScanSuccessRate`: pantry scans with detected ingredients divided by attempts.
- `budget.averageUtilizationPct`: average selected-menu cost as a percentage of user budget.
- `budget.averageAffordableOptionRatePct`: percentage of generated options that
  keep the projected menu within the user's stated budget.
- `budget.averageMarginalCost`: average median incremental cost of adding another recipe.
- `pantryIntelligence.averageCorrectionRatePct`: how often users add or remove
  ingredients after photo recognition.
- `pantryIntelligence.averageUserAddedIngredients`: ingredients users add after a scan.
- `preferenceLearning.selectionRatePct`: selected recipes divided by generated recipe options.
- `preferenceLearning.saveRatePct`: saved recipes divided by recipe selections.
- `preferenceLearning.recipeRepeats`: previously saved or scheduled recipes selected again.
- `learningSignals.topSelectedProteins`: protein concepts users select most often.
- `learningSignals.topDeselectedProteins`: protein concepts users remove most often.
- `learningSignals.topSavedProteins`: protein concepts users save most often.
- `learningSignals.topMarkets`: coarse markets such as `us-nyc`, `canada`, and `uk`.
- `groceryPriceIntelligence.averageAbsoluteErrorPct`: average difference between
  the estimated grocery total and optional user-reported checkout totals.
- `groceryPriceIntelligence.closeRatePct`: share of estimate feedback marked "Close."
- `recipeCache.cacheHitRatePct`: share of generation sessions served from cached recipes.
- `ai.inputTokens`, `ai.outputTokens`, and `ai.averageLatencyMs`: model usage and speed.
- `ai.estimatedCostUsd`: estimated model cost when token rates are configured.
- `retention.repeatWeeklyPlanners`: users who generated plans in at least two
  different calendar weeks during the requested window.
- `retention.d7RetentionRate`: percentage of eligible users who reopened the app
  7-13 days after their first recorded app open.

## Render Setup

1. Open the production API service in Render.
2. Open **Environment**.
3. Add `ANALYTICS_ADMIN_KEY` with a long random value.
4. Optionally add `OPENAI_INPUT_COST_PER_1M` and `OPENAI_OUTPUT_COST_PER_1M`
   using the current rates for the configured model.
5. Save and deploy the latest backend commit.

Generate a key in PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower()
```

## Pull A 30-Day Summary

```powershell
$headers = @{ "x-analytics-key" = "YOUR_ANALYTICS_ADMIN_KEY" }
Invoke-RestMethod `
  -Uri "https://cutplate-api.onrender.com/api/admin/analytics/summary?days=30" `
  -Headers $headers |
  ConvertTo-Json -Depth 6
```

Change `days=30` to `7`, `90`, or another reporting window. The endpoint accepts
values from 1 to 3650 days.

## Pitch Deck Fields

Use these response fields:

| Pitch deck label | API field |
| --- | --- |
| Early users | `users.allTime` |
| Weekly active users | `users.active7d` |
| Meal plans created | `activity.mealPlansGeneratedAllTime` |
| Shopping lists created | `activity.shoppingListsCreated` |
| D7 retention | `retention.d7RetentionRate` |
| Plan completion | `funnel.planStartToGeneratedRate` |
| Average AI cost per active user | `ai.estimatedCostPerActiveUserUsd` |
| Average session length | `activity.averageSessionMinutes` |
| Pantry scan success | `funnel.pantryScanSuccessRate` |
| Pantry correction rate | `pantryIntelligence.averageCorrectionRatePct` |
| Affordable recipe options | `budget.averageAffordableOptionRatePct` |
| Recipe selection rate | `preferenceLearning.selectionRatePct` |
| Recipe repeat signals | `preferenceLearning.recipeRepeats` |
| Grocery estimate error | `groceryPriceIntelligence.averageAbsoluteErrorPct` |
| Grocery estimate close rate | `groceryPriceIntelligence.closeRatePct` |
| Recipe cache hit rate | `recipeCache.cacheHitRatePct` |

`shoppingListsCreated` is the count for the selected reporting window. For an
all-time value, request a sufficiently large window such as `days=3650`.

## Notes

- Events with platform `manual` or `test` are excluded from reports.
- Anonymous installation ID is the primary user key because it remains stable
  before and after optional profile creation.
- Exact ZIP/postal codes and pantry-photo contents are not stored in analytics.
  Market reporting uses broad regions only.
- Store names and checkout totals are only submitted through the optional
  "How close was this estimate?" grocery-list feedback form.
- Grocery-price intelligence now measures estimates, budget fit, broad markets,
  and optional actual checkout totals. Retailer-specific live pricing still
  requires retailer feeds, affiliate catalogs, or receipt integrations.

## Defensibility Event Map

| Data loop | Events | What it can improve |
| --- | --- | --- |
| Pantry-image recognition | `pantry_photo_scanned`, `pantry_scan_confirmed` | Detection accuracy, missed ingredients, confidence calibration |
| Budget-aware optimization | `menu_pricing_updated`, `menu_selected`, `recipe_selection_blocked` | Affordable option mix, marginal cost, budget utilization |
| Preference learning | `recipe_selection_changed`, `recipe_saved`, `recipe_repeated`, `recipe_unsaved` | Ranking, repeats, proteins and recipe styles people keep or reject |
| Grocery-price intelligence | `grocery_list_viewed`, `grocery_estimate_feedback` | Regional multipliers and estimate error |
| Funnel and retention | `session_started`, `session_ended`, `screen_viewed`, `app_opened` | Drop-off, session quality, D7 retention |
| Cost efficiency | `ai_request_completed`, `ai_request_failed`, generation cache fields | AI cost, latency, reliability, cache reuse |

New events begin populating after the updated mobile build is installed. Existing
historical events remain valid; metrics that depend on new events will initially
return zero or `null` until users complete those actions.
