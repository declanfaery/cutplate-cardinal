import assert from 'node:assert/strict';
import test from 'node:test';
import { trackAnalyticsEvent } from '../src/analytics.js';

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
