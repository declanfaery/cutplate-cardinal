create extension if not exists pgcrypto;

create table if not exists public.grocery_price_observations (
  id uuid primary key default gen_random_uuid(),
  feedback_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text,
  email text,
  anonymous_id text,
  plan_id text,
  market text not null default 'global',
  store_name text,
  currency text not null default 'USD',
  estimated_total numeric(12, 2) not null,
  actual_total numeric(12, 2) not null,
  raw_ratio numeric(10, 5) not null,
  clamped_ratio numeric(10, 5) not null,
  user_rating text,
  derived_rating text not null,
  estimated_line_items jsonb not null default '[]'::jsonb,
  app_version text,
  platform text,
  constraint grocery_price_estimated_total_positive check (estimated_total > 0),
  constraint grocery_price_actual_total_positive check (actual_total > 0)
);

create index if not exists grocery_price_market_time_idx
  on public.grocery_price_observations (market, currency, created_at desc);

create index if not exists grocery_price_store_time_idx
  on public.grocery_price_observations (market, currency, lower(store_name), created_at desc)
  where store_name is not null;

create index if not exists grocery_price_user_time_idx
  on public.grocery_price_observations (user_id, created_at desc)
  where user_id is not null;

create index if not exists grocery_price_email_time_idx
  on public.grocery_price_observations (lower(email), created_at desc)
  where email is not null;

with historical_feedback as (
  select
    created_at,
    user_id,
    email,
    anonymous_id,
    coalesce(nullif(properties->>'coarseMarket', ''), 'global') as market,
    nullif(properties->>'storeName', '') as store_name,
    coalesce(nullif(properties->>'currency', ''), 'USD') as currency,
    (properties->>'estimatedTotal')::numeric as estimated_total,
    (properties->>'actualTotal')::numeric as actual_total,
    nullif(properties->>'rating', '') as user_rating,
    app_version,
    platform,
    row_number() over (
      partition by
        coalesce(nullif(user_id, ''), nullif(email, ''), nullif(anonymous_id, ''), 'unknown'),
        coalesce(nullif(properties->>'coarseMarket', ''), 'global'),
        lower(coalesce(nullif(properties->>'storeName', ''), '')),
        properties->>'estimatedTotal',
        properties->>'actualTotal'
      order by created_at
    ) as duplicate_rank
  from public.analytics_events
  where event_name = 'grocery_estimate_feedback'
    and properties->>'estimatedTotal' ~ '^[0-9]+(\.[0-9]+)?$'
    and properties->>'actualTotal' ~ '^[0-9]+(\.[0-9]+)?$'
)
insert into public.grocery_price_observations (
  feedback_id,
  created_at,
  updated_at,
  user_id,
  email,
  anonymous_id,
  market,
  store_name,
  currency,
  estimated_total,
  actual_total,
  raw_ratio,
  clamped_ratio,
  user_rating,
  derived_rating,
  app_version,
  platform
)
select
  'legacy-' || md5(concat_ws(
    '|',
    coalesce(nullif(user_id, ''), nullif(email, ''), nullif(anonymous_id, ''), 'unknown'),
    market,
    lower(coalesce(store_name, '')),
    estimated_total::text,
    actual_total::text
  )),
  created_at,
  created_at,
  user_id,
  email,
  anonymous_id,
  market,
  store_name,
  currency,
  estimated_total,
  actual_total,
  actual_total / estimated_total,
  greatest(0.65, least(1.65, actual_total / estimated_total)),
  user_rating,
  case
    when actual_total / estimated_total > 1.08 then 'too_low'
    when actual_total / estimated_total < 0.92 then 'too_high'
    else 'close'
  end,
  app_version,
  platform
from historical_feedback
where duplicate_rank = 1
  and estimated_total > 5
  and actual_total > 5
  and actual_total / estimated_total between 0.35 and 2.5
on conflict (feedback_id) do nothing;
