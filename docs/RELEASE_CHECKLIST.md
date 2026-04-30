# CutPlate Cardinal Release Checklist

## Windows to iOS App Store

This Expo app can be built for iOS from Windows by using EAS cloud builds.

1. Create an Apple Developer account and an Expo account.
2. From `mobile/`, run `npx eas login`.
3. Run `npx eas init` once to connect the Expo project.
4. Confirm the iOS bundle id in `mobile/app.json`: `com.cutplate.cardinal`.
5. Store production environment values in EAS, not in Git.
6. Build a staging/TestFlight candidate:
   ```powershell
   npm run eas:ios:stage
   ```
7. Build production:
   ```powershell
   npm run eas:ios:prod
   ```
8. Submit the latest production build to App Store Connect:
   ```powershell
   npm run eas:ios:submit
   ```

## Branch Flow

- `main`: production-ready code only.
- `stage`: feature testing branch for EAS preview builds and TestFlight.
- feature branches: short-lived branches from `stage`.

Recommended update flow:

```powershell
git checkout stage
git pull
git checkout -b feature/pantry-upgrades

# work, test, commit
npm run check
git add .
git commit -m "Add pantry upgrade"

git checkout stage
git merge feature/pantry-upgrades
npm run eas:ios:stage

# after TestFlight looks good
git checkout main
git merge stage
npm run eas:ios:prod
npm run eas:ios:submit
```

## App Store Review Notes

- Add a privacy policy URL and support URL before submission.
- Because the app creates accounts, keep the in-app account deletion path working before every App Store review.
- Email confirmation needs a production email sender. The server supports Resend with `RESEND_API_KEY` and `EMAIL_FROM`.
- Keep OpenAI and email keys on the server or in EAS/server secrets. Never expose them through `EXPO_PUBLIC_` variables.
- Recipe macros, prices, and shopping lists should remain clearly labeled as estimates.
- Avoid claiming medical treatment, diagnosis, or guaranteed weight loss. Keep the nutrition safety note visible.
- Make sure social recipe sourcing is opt-in and does not copy protected creator content verbatim.
- Create App Store screenshots from a real iPhone/TestFlight session before submission.
