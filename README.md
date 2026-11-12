# Crewboard

**Your crew, your board, your flow.**

A task board for your team, built on React + Vite + TypeScript + Tailwind and Firebase
(Auth, Firestore, Cloud Functions v2 on Node 20, Hosting). Email goes out over SMTP via Nodemailer.

## Build status

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, invites, roles, admin panel, profile, branded email | ✅ Done |
| 2 | Boards, columns, tasks, drag and drop, task panel, comments, activity log | ✅ Done |
| 3 | @mentions, assignment and mention notifications (in-app + email) | ✅ Done |
| 4 | My Tasks, list view with filters and search, daily digest | ✅ Done |

## Project layout

```
crewboard/
├── firebase.json              Hosting, Functions, Firestore, emulator config
├── firestore.rules            Security rules
├── firestore.indexes.json     Composite indexes (grows in later phases)
├── scripts/create-admin.mjs   Creates the first admin
├── functions/                 Cloud Functions (TypeScript)
│   └── src/
│       ├── config.ts          Region, SMTP secrets, APP_URL param
│       ├── lib/               Admin SDK, types, validation, auth guards
│       ├── email/             Brand tokens, HTML+text renderer, mailer, messages
│       ├── users/admin.ts     inviteUser, resendInvite, setUserRole, setUserActive
│       ├── auth/passwordReset.ts  requestPasswordReset (branded "forgot password")
│       ├── boards/triggers.ts onBoardWritten (member sync, cleanup), onColumnUpdated
│       ├── tasks/             diff.ts + triggers: activity log, comment counts, notifications, cleanup
│       ├── notifications/     mention parsing, fan-out, onNotificationCreated (email)
│       └── digest/daily.ts    dailyDigest — "Your Crewboard day" at 9:00 AM
├── web/                       React app
│   └── src/
│       ├── lib/               Firebase init, typed Firestore helpers, API wrappers, theme
│       ├── auth/              AuthProvider (live role/active sync), route guards
│       ├── components/        AppShell, Logo, Avatar, Modal, Toast, Popover, Markdown, form controls
│       │   ├── board/         Kanban (dnd-kit), columns, cards, board settings
│       │   └── task/          Side panel: fields, description, checklist, links, comments, activity
│       └── pages/             Login, Forgot password, Auth action, Boards, Board, My Tasks, Profile, Admin › People
├── rules-tests/               Security-rules tests (Vitest + Emulator Suite)
└── docs/                      Sample rendered emails
```

## How sign-in works

There's no public sign-up. An admin invites someone from **People**; the `inviteUser` function creates
the Auth user, writes `/users/{uid}`, sets the `role` custom claim, and emails a "Welcome to Crewboard"
message. The link inside is generated with `generatePasswordResetLink`, but Crewboard wraps its code in
its own URL (`/auth/action?mode=setup&oobCode=…`), so people set their password on a Crewboard-branded
page rather than Firebase's default one. "Forgot password" works the same way through `requestPasswordReset`,
so every email comes from `Crewboard <SMTP_FROM>` with the branded template.

Role changes and deactivation take effect immediately: the function bumps `claimsUpdatedAt` on the user's
doc, the app sees it live and refreshes the ID token. Deactivation also disables the Auth user and revokes
refresh tokens, and the security rules check `active` on every request.

Guard rails: admins can't change their own role or deactivate themselves, and Crewboard always keeps at least
one active admin.

## Boards and tasks

Admins and managers create boards and choose who's on them; only members can see a board and its
tasks (this includes admins — add yourself to see a board). New boards start with Backlog, To Do,
In Progress, In Review and Done. Managers can add, rename, reorder (drag the grip) and delete columns,
and mark which column means "done"; done tasks are never shown as overdue.

Anyone on the board can create tasks, drag them between columns, and edit them in the side panel,
which has its own URL (`/boards/{boardId}/tasks/{taskId}`) so links can be shared. Overdue tasks get a
red edge and an "Overdue" badge. Cards can be moved with the keyboard: Tab to a card, Space to pick it
up, arrow keys to move, Space or Enter to drop; Enter on a card opens it.

Every change to a task is recorded in its **Activity** tab. The log is written by a Cloud Function that
diffs each version of the task, so it can't be skipped or forged from the browser. Reordering within a
column isn't logged.

Order is stored as fractional `position` numbers, so moving a card or column writes a single document.
Removing someone from a board automatically unassigns them from its tasks. Deleting a board deletes all
of its tasks, comments and activity.

## Mentions and notifications

Type **@** in a task description or comment to pick a board member, or **@all** to mention everyone on
the board. You can mention several people in one comment. Mentions are stored inline in the markdown as
`@[Name](user:<uid>)` (so the preview tab shows chips) and the mentioned ids are saved in
`mentionedUserIds` on the comment and on the task.

When someone is **assigned** (from the task panel) or **@mentioned**, a Cloud Function creates an in-app
notification. The bell in the header shows a live unread count; you can mark items read or unread, or
mark all read. A second function then sends a Crewboard email with who did it, the task title, the board,
a snippet of the comment or description, and a **View task** button that opens the task directly.

The rules: you're never notified about your own actions; if one action both assigns and mentions you,
you get one notification (and one email); deactivated users and people not on the board get nothing; and
emails follow each person's **Email me when I'm assigned** / **@mentioned** preferences (in-app
notifications are always on). Mentions added later by editing a comment or description notify only the
newly mentioned people. Each notification records `emailStatus` (`sent`, `skipped`, or `failed`) so you
can see in Firestore why an email did or didn't go out.

## Views

- **Board** (`/boards/{id}`): the Kanban board.
- **List** (`/boards/{id}?view=list`): every task on the board in a table, with text search (titles and
  descriptions) and filters for assignee (including "Assigned to me" and "Unassigned"), label, priority,
  due date (overdue, today, next 7 days, none) and status. Sort by status, due date, priority or recently
  updated. On phones the rows stack.
- **My Tasks** (`/my-tasks`): everything assigned to you or mentioning you, across all your boards,
  grouped into Overdue, Today, Tomorrow, Next 7 days, Later and No due date. Switch between All, Assigned
  to me and Mentioned me, and choose whether to show done tasks.
- **Task panel** (`/boards/{id}/tasks/{taskId}`): opens over whichever view you came from; closing it
  takes you back there. The URL can be shared.

## Daily digest

`dailyDigest` runs every day at **9:00 AM in `DIGEST_TIMEZONE`**. Each active user who has
**Daily digest** turned on gets one "Your Crewboard day" email listing the tasks assigned to them that are
overdue or due today (tasks in a done column are left out), each linking straight to the task, plus an
**Open My Tasks** button. People with nothing due get no email that day. A marker in `_digests/` makes
sure a retried run never sends the same person two digests on one day.

"Today" is the calendar date in `DIGEST_TIMEZONE`, so pick the zone where most of your team works.

## Data model

### Collections at a glance
```
users/{uid}
boards/{boardId}
boards/{boardId}/columns/{columnId}
tasks/{taskId}                       top-level so "My Tasks" can query across boards
tasks/{taskId}/comments/{commentId}
tasks/{taskId}/activity/{eventId}    server-written
notifications/{notificationId}       server-written; recipient can mark read
_throttle/{id}                       server-only
_digests/{uid}_{date}                server-only; one per user per day sent
```

### `users/{uid}`
| Field | Type | Notes |
|---|---|---|
| `uid` | string | Same as doc id |
| `email` | string | Lower-cased |
| `displayName` | string | 1–80 chars, user-editable |
| `role` | `"admin" \| "manager" \| "member"` | Mirror of the custom claim; server-only |
| `active` | boolean | Server-only |
| `avatarUrl` | string \| null | https URL, user-editable; initials shown when null |
| `notificationPrefs` | `{ emailOnAssignment, emailOnMention, dailyDigest }` | booleans, user-editable |
| `invitedBy` | string \| null | uid of inviting admin |
| `lastInviteSentAt` | timestamp \| null | |
| `claimsUpdatedAt` | timestamp | Bumped on role change; tells clients to refresh tokens |
| `createdAt`, `updatedAt` | timestamp | |

### `boards/{boardId}`
| Field | Type | Notes |
|---|---|---|
| `name` | string | 1–80 chars |
| `description` | string | ≤ 500 chars |
| `memberIds` | string[] | Who can see the board; at least one |
| `labels` | `{ id, name, color }[]` | Board's label set; any member can edit |
| `createdBy` | string | |
| `createdAt`, `updatedAt` | timestamp | |

### `boards/{boardId}/columns/{columnId}`
| Field | Type | Notes |
|---|---|---|
| `name` | string | 1–40 chars |
| `position` | number | Fractional order |
| `isDone` | boolean | Tasks here count as done |
| `createdAt` | timestamp | |

### `tasks/{taskId}`
| Field | Type | Notes |
|---|---|---|
| `boardId`, `columnId` | string | |
| `position` | number | Fractional order within the column |
| `title` | string | 1–200 chars |
| `description` | string | Markdown, ≤ 20,000 chars |
| `priority` | `low \| medium \| high \| urgent` | |
| `labelIds` | string[] | Ids from the board's `labels` |
| `dueDate` | `"YYYY-MM-DD"` \| null | A calendar date, so it never shifts across time zones |
| `assigneeIds` | string[] | Must be board members |
| `mentionedUserIds` | string[] | Everyone @mentioned in the description or comments |
| `memberIds` | string[] | Copy of the board's members, kept in sync by `onBoardWritten`; used by rules and queries |
| `checklist` | `{ id, text, done }[]` | |
| `attachments` | `{ id, url, title }[]` | Links |
| `done` | boolean | Mirrors the column's `isDone` |
| `commentCount` | number | Maintained by `onCommentWritten` |
| `createdBy`, `updatedBy` | string | `updatedBy` must be the editor (or `"system"` for server changes) |
| `createdAt`, `updatedAt` | timestamp | |

### `tasks/{taskId}/comments/{commentId}`
| Field | Type | Notes |
|---|---|---|
| `authorId` | string | Only the author can edit or delete |
| `body` | string | Markdown, ≤ 10,000 chars |
| `mentionedUserIds` | string[] | Ids mentioned in this comment (@all expanded) |
| `edited` | boolean | |
| `createdAt`, `updatedAt` | timestamp | |

### `tasks/{taskId}/activity/{eventId}`
Written only by Cloud Functions. `{ type: "created" | "updated" | "commented", actorId, changes[], commentId?, createdAt }`,
where each change names the field and what changed (`from`/`to`, or `added`/`removed`, or a checklist `action` and `text`).

### `notifications/{notificationId}`
Id is `<triggerEventId>_<recipientId>`, so retried triggers never duplicate a notification.

| Field | Type | Notes |
|---|---|---|
| `recipientId` | string | Only this user can read it |
| `type` | `assigned \| mentioned` | |
| `alsoMentioned` | boolean | Assigned and mentioned in the same action |
| `actorId` | string | Who did it |
| `taskId`, `boardId` | string | |
| `taskTitle`, `boardName` | string | Copied at creation time |
| `source` | `task \| description \| comment` | |
| `commentId` | string \| null | |
| `snippet` | string | Plain text, ≤ 280 chars |
| `read` | boolean | Recipient-editable, with `readAt` |
| `emailStatus` | `pending \| sent \| skipped \| failed` | Server-written |
| `createdAt` | timestamp | |

### `_throttle/{id}`
Server-only. Rate-limits password-reset emails (one per address per minute).

### Indexes
`firestore.indexes.json` defines:
- `tasks (boardId ASC, memberIds CONTAINS)` for the board and list views,
- `tasks (assigneeIds CONTAINS, done ASC, dueDate ASC)` for the daily digest,
- `notifications (recipientId ASC, createdAt DESC)` for the bell.

My Tasks uses single-field `array-contains` queries, which need no composite index.

---

## Setup

### Prerequisites
- Node.js 20+
- Java 17+ (for the Firestore emulator)
- Firebase CLI: `npm install -g firebase-tools`, then `firebase login`

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Run locally with emulators (no Firebase project needed)

The emulators run under the demo project `demo-crewboard`, so nothing touches production.

**a. Catch emails locally with Mailpit.** It's a small local SMTP server with a web inbox.
```bash
# macOS: brew install mailpit && mailpit
# Docker: docker run -p 8025:8025 -p 1025:1025 axllent/mailpit
```
Then copy the emulator secrets:
```bash
cp functions/.secret.local.example functions/.secret.local
```

**b. Start the emulators** (terminal 1):
```bash
npm run emulators
```
Emulator UI: http://localhost:4000. Data persists between runs in `.emulator-data/`.

**c. Start the web app** (terminal 2). `web/.env.local` is already set for emulators.
```bash
npm run dev:web
```

**d. Create your admin** (terminal 3):
```bash
npm run create-admin -- --emulator --email you@company.com --name "Your Name"
```
Open the printed link, set a password, and you're in. Invite emails sent from **People** appear in
Mailpit at http://localhost:8025.

**e. Run the security-rules tests:**
```bash
npm run test:rules
```

### 3. Create the Firebase project
1. In the [Firebase console](https://console.firebase.google.com), click **Add project**.
2. Upgrade to the **Blaze** plan (*Usage and billing › Details & settings › Modify plan*). Cloud Functions
   and outbound SMTP require it. Set a budget alert while you're there.
3. **Authentication › Get started › Sign-in method:** enable **Email/Password**. Leave public sign-up to
   the app — there's no sign-up screen, and you can additionally block it in
   *Authentication › Settings › User actions* by unchecking **Enable create (sign-up)**.
4. **Firestore Database › Create database** in production mode. Pick a location close to your team;
   it can't be changed later.
5. **Project settings › Your apps › Web app (</>):** register an app and copy the config values.
6. Link the CLI to the project:
   ```bash
   cp .firebaserc.example .firebaserc   # then put your project id in it
   ```
7. Optional: change `REGION` in `functions/src/config.ts` to the region nearest your team (for example
   `europe-west1`, `asia-south1`), and set the same value as `VITE_FUNCTIONS_REGION` below.

### 4. Configure the web app for production
Create `web/.env.production` from the commented block in `web/.env.example` with your web-app config
and `VITE_USE_EMULATORS=false`.

### 5. Set the SMTP secrets
Any SMTP provider works (Google Workspace SMTP relay, SendGrid, Mailgun, Amazon SES, Postmark…).
```bash
firebase functions:secrets:set SMTP_HOST    # e.g. smtp.sendgrid.net
firebase functions:secrets:set SMTP_PORT    # 587 (STARTTLS) or 465 (TLS)
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_FROM    # e.g. crewboard@yourcompany.com
```
Emails are sent as `Crewboard <SMTP_FROM>`. Make sure your provider has that sender verified, with SPF
and DKIM set up for the domain, or messages will land in spam.

### 6. Set the app URL and digest time zone
Create `functions/.env.<your-project-id>`:
```
APP_URL=https://<your-project-id>.web.app
DIGEST_TIMEZONE=America/New_York
```
Use any [IANA time zone name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) for
`DIGEST_TIMEZONE` (for example `Europe/London`, `Asia/Singapore`, `Australia/Sydney`). If you skip this
file, `firebase deploy` asks for both values and saves the file for you. If you use a custom domain, use
that URL for `APP_URL` and add the domain under *Authentication › Settings › Authorized domains*.

### 7. Deploy
```bash
firebase deploy
```
This builds and deploys Functions, Firestore rules and indexes, and Hosting. On the first deploy the CLI
may ask to enable APIs (Cloud Functions, Cloud Build, Artifact Registry, Eventarc, Cloud Scheduler,
Secret Manager) — answer yes. New indexes take a few minutes to build; until they finish, the board,
bell or digest can show an "index is building" error.

### 8. Create the first admin in production
Authenticate the Admin SDK once:
```bash
gcloud auth application-default login
# or: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```
Then:
```bash
npm run create-admin -- --project <your-project-id> --email you@company.com --name "Your Name"
```
Open the printed link to set your password. From then on, invite everyone else from **People**.

### 9. Launch checklist
Before inviting the team, run through this once in production:
1. `npm run test:rules` passes locally.
2. Invite a test account from **People**; the welcome email arrives from **Crewboard** and the setup
   link works.
3. **Forgot your password?** sends a branded email.
4. Create a board, add the test account, and assign it a task: the bell updates and an assignment
   email arrives. @mention it in a comment: one mention email arrives.
5. Give a task today's due date, then in the Google Cloud console open **Cloud Scheduler**, find the
   `dailyDigest` job and click **Force run**. The digest arrives.
6. Deactivate the test account and confirm it's signed out.

### Testing the digest locally
The emulator doesn't run schedules on its own. Start the emulators, then in another terminal:
```bash
firebase functions:shell --project demo-crewboard
> dailyDigest()
```
If your CLI version can't invoke scheduled functions from the shell, use **Force run** in Cloud Scheduler
after deploying (launch checklist, step 5).
The emulator uses `DIGEST_TIMEZONE=UTC` from `functions/.env.local`; change it there to test your zone.
Emails land in Mailpit.

## Branding

**Logo.** The source logo is `web/public/crewboard-logo.svg` (icon, wordmark and tagline), with
`crewboard-logo-dark.svg` as a light-text version for dark backgrounds. In the app, the board icon from
that file is drawn inline by `web/src/components/Logo.tsx`; the "Crewboard" wordmark and tagline beside
it are live text in Inter (the logo's typeface), so they switch to white in dark mode.

Generated from the same icon:

| File | Used for |
|---|---|
| `web/public/favicon.svg` | Browser tab icon |
| `web/public/favicon-32.png` | Tab icon for browsers without SVG favicon support |
| `web/public/apple-touch-icon.png` | Home-screen icon on iPhone/iPad (180×180) |
| `web/public/email-logo.png` | Email header (96×96, shown at 40×40) |

Emails load `email-logo.png` from your hosted site (`APP_URL`), because email clients block SVG. If a
recipient has images turned off, the "Crewboard" wordmark text still shows.

**To replace the logo later:** swap `crewboard-logo.svg`, copy its icon shapes into `LogoMark` in
`Logo.tsx`, and regenerate the three PNGs and `favicon.svg` from the icon.

**Brand color.** Indigo, matching the logo's gradient. To change it, edit `brand` in
`web/tailwind.config.js` and `BRAND.color` (plus its dark/soft shades) in
`functions/src/email/brand.ts`.

**Email previews** are in `docs/` (`email-preview-welcome.html`, `email-preview-assigned.html`,
`email-preview-digest.html`).

## Troubleshooting
- **Invite says the email didn't send.** The user was still created. Check the function logs
  (`firebase functions:log`) for the SMTP error, fix the secret, then use **Resend invite**.
- **"This link doesn't work."** Setup and reset links last 1 hour and work once. Resend the invite, or use
  **Forgot your password?**.
- **Someone didn't get a notification email.** Open their notification in Firestore and check
  `emailStatus`: `skipped` means their preferences turned it off; `failed` means SMTP rejected it (see
  `firebase functions:log`).
- **No digest arrived.** Digests only go to people with the preference on and at least one assigned task
  due today or overdue. Check the `dailyDigest` logs (`firebase functions:log --only dailyDigest`); the
  last line reports how many were sent.
- **Role change not showing.** It applies within a second or two while the app is open; if not, sign out
  and back in.
