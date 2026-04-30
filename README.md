# CutPlate AI

CutPlate AI is a full-stack meal planning MVP for iOS, Android, and web. Users choose a plan length, proteins, meal types, meal times, goals, and creator source seeds. The API returns daily recipes, ingredients, steps, estimated macros, source links, and a shopping list.

## What Is Built

- Expo React Native app in `mobile/`
- Express API in `server/`
- Optional OpenAI-powered planner with web search when `OPENAI_API_KEY` is configured
- Local recipe engine fallback so the app works immediately with no API key
- Creator source seed links for `@roadtoaesthetics`, `@noahperlofit`, `@fairfiteats`, and `@nickazfit`
- API tests for the local recipe engine

## Quick Start

From `C:\Users\Owner\OneDrive\Desktop\mealplan_app`:

```powershell
npm install
npm install --prefix server
npm install --prefix mobile
npm run dev
```

The API runs at:

```text
http://localhost:4000
```

The web app opens from Expo. If it does not open automatically, use the URL printed by Expo, usually:

```text
http://localhost:8081
```

## AI Setup

The app works without OpenAI credentials by using the local recipe engine. To enable connected recipe generation:

1. Create `server/.env` from `server/.env.example`.
2. Add your key:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-nano
OPENAI_REASONING_EFFORT=low
PORT=4000
CORS_ORIGIN=*
PLAN_AI_TIMEOUT_MS=0
PLAN_WEB_SEARCH=false
```

The server uses the OpenAI Responses API with structured JSON output. `gpt-5-nano` is the default for faster first-time generation, and `PLAN_AI_TIMEOUT_MS=0` makes the first request wait until recipes are ready instead of failing while the cache warms. Keep `PLAN_WEB_SEARCH=false` unless you explicitly want slower live web search during generation.

## Grocery Estimates

The app asks for a ZIP code or city/state. The API estimates groceries from the generated ingredients, selected meals per day, servings per meal, and a regional price multiplier. These are planning estimates, not live store prices. Exact prices need a grocery provider integration such as Kroger, Walmart, or Instacart.

## Test The Backend

```powershell
npm test
```

Manual API check:

```powershell
Invoke-RestMethod -Method Post http://localhost:4000/api/plan -ContentType "application/json" -Body '{"days":3,"proteins":["Chicken","Salmon"],"mealSlots":[{"type":"Lunch","time":"12:30 PM"},{"type":"Dinner","time":"6:30 PM"}]}'
```

## Test Android On Windows

1. Install Android Studio.
2. Create an Android emulator from Android Studio Device Manager.
3. Start the API:

```powershell
npm run dev:api
```

4. Start Expo for Android:

```powershell
npm run android
```

The app defaults Android emulator API calls to `http://10.0.2.2:4000`, which points back to your Windows machine.

## Test iOS Without A Mac

You cannot run Apple Simulator on Windows. Practical options:

- Test the shared UI and API behavior in Expo web with `npm run web`.
- Use Expo Go on a physical iPhone on the same Wi-Fi network.
- Use EAS cloud builds for iOS when you are ready for TestFlight/App Store.
- Use a remote device service if you need true iOS device testing without owning the device.

For Expo Go on an iPhone, set `mobile/.env` to your Windows LAN IP:

```env
EXPO_PUBLIC_API_URL=http://YOUR_WINDOWS_LAN_IP:4000
```

Then run:

```powershell
npm run dev:api
npm run dev:mobile
```

Scan the Expo QR code with the iPhone. The API and phone must be on the same network, and Windows Firewall must allow Node on port `4000`.

## Store Build Path

This repo is Expo-ready, so you can build Android and iOS in the cloud later:

```powershell
cd mobile
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build -p android
npx eas-cli@latest build -p ios
```

Google Play requires an Android App Bundle. Apple App Store distribution requires an Apple Developer account. A Mac is not required for EAS cloud builds, but Apple account setup and TestFlight review still apply.

## Source And Content Notes

The MVP does not scrape TikTok or copy creator recipes. Creator handles are used as public discovery seeds and attribution links. Before publishing creator-specific recipes, verify the source URL and reuse rights. Macro values are estimates and should be checked against exact brands and portion sizes.
