# Comprobantes

An Android app (React Native + Expo) for logging expenses day by day in a calendar and sharing that calendar with people from your contact list.

## Features

- Sign up / sign in with email and password (Firebase Auth).
- Create one or more **expense calendars**, each in **ARS** or **USD**. A month view shows each day's total, and you tap a day to see or add its expenses.
- **Share** a calendar with a device contact, using one of two permissions:
  - **Can view** (`read`): sees every expense.
  - **Can view & add** (`write`): sees every expense, adds new ones, and deletes the ones they added.
- The owner can change someone's permission or remove their access at any time.
- **Fingerprint unlock:** an optional "Desbloquear con huella" switch at the bottom of the calendar list. When it's on and the app opens with a saved session, the lock screen asks for a fingerprint before showing anything. If the fingerprint fails, "Ingresar con contraseña" signs out so you can sign in with email and password. The setting is saved on the device for each user (`src/lib/biometrics.ts`, `src/hooks/useStartupLock.ts`).
- **Share notifications:** when someone shares a calendar with you, your phone gets a push notification ("Te compartieron un calendario"). Tapping it opens that calendar. Changing someone's permission doesn't send a notification.
- **Deleting:** owners can delete any expense, and writers can delete the ones they added (the "Eliminar" link on the day screen). The owner can also delete a whole calendar with all its expenses ("Eliminar calendario" at the bottom of the month view).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 58, React Native 0.88, TypeScript |
| Navigation | Expo Router (file-based, `src/app/`) |
| Auth + database | Firebase JS SDK (Auth + Cloud Firestore), live updates via `onSnapshot` |
| Contacts | `expo-contacts` |
| Biometrics | `expo-local-authentication` |
| Push notifications | `expo-notifications` + Expo push service, sent from a Cloud Function (`firebase/functions`) |

## Project layout

```
src/
  app/                         # Screens (Expo Router)
    _layout.tsx                # Auth guard (Stack.Protected) + navigator
    sign-in.tsx
    index.tsx                  # My calendars (own + shared)
    calendar/[id]/index.tsx    # Month view
    calendar/[id]/day/[date].tsx
    calendar/[id]/add-expense.tsx   (modal, write/owner only)
    calendar/[id]/share.tsx         (owner only)
  components/                  # UI building blocks, MonthGrid, PermissionPicker
  context/AuthContext.tsx
  hooks/useCalendar.ts         # live calendar + current user's role
  lib/                         # firebase init, permissions, dates, money, phone
  services/                    # Firestore/Contacts access (auth, calendars, expenses, contacts)
  types/models.ts
firebase/                      # Backend config, kept separate from the app's dependencies
  firestore.rules              # Server-side permission enforcement
  tests/                       # Rules tests (run against the emulator)
```

## Data model (Firestore)

```
users/{uid}
  displayName, emailLower, phones[]        # used to match device contacts

users/{uid}/pushTokens/{expoPushToken}     # private to the user
  platform, updatedAt

calendars/{calendarId}
  name, currency ('ARS' | 'USD'), ownerId, createdAt
  members:     { [uid]: 'owner' | 'read' | 'write' }   # source of truth for permissions
  memberNames: { [uid]: string }
  memberIds:   [uid]                                    # mirror of members keys, for queries

calendars/{calendarId}/expenses/{expenseId}
  date ('YYYY-MM-DD'), amountCents (int), description, category,
  createdBy, createdByName, createdAt
```

Permissions are checked in two places:

- `src/lib/permissions.ts` decides what the UI shows (buttons and screens).
- `firebase/firestore.rules` is the actual enforcement. A user who is removed or downgraded loses access right away, even if the app is tampered with.

If you change one, update the other and run the rules tests.

## Getting started

### 1. Firebase project

1. Create a project at <https://console.firebase.google.com>.
2. Enable **Authentication → Email/Password**.
3. Create a **Cloud Firestore** database.
4. Add a **Web app** and copy its config values.
5. Run `cp .env.example .env` and fill in the values.
6. Deploy the rules:
   ```bash
   cd firebase && npm install
   npx firebase login
   npx firebase use --add          # choose your project
   npm run deploy:rules
   ```

### 2. Push notifications (optional)

Without this setup the app still works; it just doesn't send share notifications.

1. **Upgrade the Firebase project to the Blaze plan.** Cloud Functions require it. It's pay-as-you-go, and the free tier covers a small app.
2. **Link an EAS project.** Run `npx eas-cli@latest init` in the app folder. This adds `extra.eas.projectId` to `app.json`, which the app needs to get a push token.
3. **Set up FCM for Android.** Follow <https://docs.expo.dev/push-notifications/fcm-credentials/>: add an Android app in Firebase with package `ar.zuppelli.expenses`, put `google-services.json` in the project root, set `"googleServicesFile": "./google-services.json"` under `android` in `app.json`, and upload the FCM V1 service account key to EAS.
4. **Check the function's region.** It's set in `firebase/functions/src/index.js` and should match your Firestore location (e.g. `southamerica-east1`).
5. **Deploy:**
   ```bash
   cd firebase/functions && npm install && cd ..
   npm run deploy                 # rules + functions
   ```

Push notifications don't work in Expo Go on Android (since SDK 53). Use a development build: `npx eas-cli@latest build --profile development -p android`, or `npm run build:android` locally.

### 3. Run the app

```bash
npm install
npm run android        # Expo dev server + Android emulator/device
```

Everything except push notifications works in Expo Go, so you can scan the QR code with Expo Go on an Android phone (the app skips push registration there). For a native build, run `npm run build:android` (`expo run:android`, which needs the Android SDK) or `npx eas-cli@latest build -p android`.

### 4. Checks

```bash
npm run typecheck                        # TypeScript
npx expo lint                            # ESLint
cd firebase && npm run test:rules        # Firestore rules tests (needs Java for the emulator)
cd firebase && npm run test:functions    # Cloud Function unit tests
cd firebase && npm run test:e2e          # Share → function → fake Expo push server, in the emulators
```

## How sharing works

1. The owner opens **Share**, picks a permission, then taps a contact.
2. The app looks for a registered user whose email matches the contact, or whose phone matches it (last 9 digits).
3. If it finds one, that user is added to `members` and the calendar appears in their list right away.
4. If not, the system share sheet opens so the owner can send an invite.
5. When a user is added, the `notifyCalendarShared` Cloud Function sends a push to each of their registered devices. It deletes tokens that Expo reports as no longer registered.

## Known limitations / next steps

- **Contact lookup privacy:** any signed-in user can read `users` profiles so the app can match contacts. Before going to production, move the lookup into a callable Cloud Function that only returns a match.
- **Phone matching** is a heuristic (last 9 digits). Store E.164 numbers (`libphonenumber-js`) and consider verifying phones with Firebase phone auth.
- **Pending invites:** inviting someone who isn't registered doesn't store anything yet. You could add an `invites` collection that a Cloud Function resolves on sign-up.
- The UI is in Spanish (Argentina, using *vos*), with strings written directly in the components. Amounts and dates use the `es-AR` locale (`LOCALE` in `src/lib/dates.ts`). To support more languages, move the strings into an i18n library such as `i18next` with `expo-localization`.
- A calendar's currency can't be changed after it's created (there's no UI for it, though the rules allow the owner to switch between ARS and USD).
- There's no "leave calendar" action for shared users, and no editing of expenses yet. The rules already allow owner/author updates.
- Generated `android/` and `ios/` folders are gitignored. Configure native settings in `app.json` (Continuous Native Generation).
