# Unilink: Connect Beyond Campus

One site that combines the Unilink community platform with a media gallery and a light/dark theme.

**Stack:** React 18, TypeScript, Vite, Tailwind CSS 3, and a local Node server with a SQLite database (auth, data, realtime chat). Everything is stored in the project folder and works offline.

## College-only and global sharing

The Community and Campus Hub pages include an audience switch:

- **My college**: shows posts, clubs, marketplace listings, events, study groups, opportunities, and lost-and-found items associated with the signed-in student's college. New content is college-only in this mode.
- **Global / all colleges**: shows content intentionally shared globally. New content is available across colleges in this mode.

Use the switch to browse the selected audience. Users must select a college in their profile before publishing college-only content. Existing posts and marketplace listings are assigned to their author's college during the one-time database migration when the new scope column is added.

## Features

- **Home page (main page):** hero slideshow, upcoming events, images and videos. Everything on it is controlled by the super admin (see below).
- **Auth:** sign up and sign in. The first account created becomes `super_admin`.
- **Chat:** global, college and private rooms with realtime messages, plus photos, videos, audio, files and polls. College chats are only for verified students of that college, and every room has a 6-digit code to share (see below).
- **Direct messages:** private 1-on-1 chats between any two people (students, alumni, admins) on the **Messages** page. Start one from "New message" (search by name, or pick an admin) or from the **Message** button on anyone's profile card. Photos and files work like in rooms, the menu shows an unread badge, and either person can block the other or report a message. Only the two people can read a conversation (not even website admins; a reported message reaches the admins). There are no commands, owners or room codes in a direct message. Under the hood it is a private room with `chat_rooms.dm_key` set (`server/dm.js`, `server/dmGuards.js`).
- **Profile badges:** custom badges (starters: Verified Alumni, Club Lead, TA) shown next to a person's name in chat, community posts and comments, direct messages, private-room member lists, profile cards and the admin student list. They update live when awarded, removed or edited. Admins create and edit badges and award them in **Admin Panel > Badges** (colour, icon, description). A badge marked "officers can award" can also be given by a verified college secretary, vice president or president, only to verified members of their own college (from the person's info card in chat). A person can hold up to 6. Rules are enforced in `server/badges.js`; the shared display is `src/components/UserBadges.tsx` and `src/lib/badges.ts`.
- **Profile completeness:** the profile page shows a progress bar and checklist (photo, bio, college, verified, a link) and collapses to "complete" at 100%. Logic: `src/components/ProfileCompleteness.tsx`.
- **@mentions:** type `@` in a room message to pick a person (suggestions are only people who can see that room). The name is highlighted for everyone, and the person gets a notification (Community > Notifications). The server decides who was mentioned and never notifies someone who cannot see the room or who blocked/was blocked by the sender. Max 5 per message. Code: `server/mentions.js`.
- **Search by role:** Community > Discover can be filtered by badge, college rank (any officer, president, vice president, secretary, committee head) and verified only, and the search box also matches college names.
- **College ranks:** president, vice president, secretary and committee head, who manage chat and rooms inside their own college only (see below).
- **Chat commands:** type `/` in any room for `/help`, `/mute`, `/kick`, `/ban` and friends. What each person may do depends on their college rank or admin role (see below).
- **Colleges:** directory plus student verification requests. About 200 colleges are included to start with: about 150 well-known Indian ones (IITs, IISc, NITs, IIITs, BITS, IIMs, leading universities and colleges, medical and law schools) and about 50 elite international universities (MIT, Stanford, Harvard, Oxford, Cambridge, ETH Zurich, NUS, Tsinghua, Tokyo and more). Each college has a **tier** (Tier 1, Tier 2 or Elite) and a **country**, and the directory can be filtered by both. The tiers are a rough guide, not an official ranking. Admins can add, edit and delete colleges in **Admin Panel > Colleges** (deleting a college also deletes its chat rooms), import many at once from a CSV file, and give each one a logo. Students can **request a missing college** (see below). The starter list is in `server/collegeSeed.js`; it is added once on the first start, and deleted colleges do not come back.
- **Events:** post and discover events across campuses. College officers can limit an event to their own college (see below).
- **Gallery:** every image and video, with tabs, category filters, search and a full-screen viewer.
- **Admin dashboard:** the first tab of the Admin Panel shows new signups, pending verifications, active rooms and open reports, with a daily activity chart (see below).
- **Profile and Admin panel:** profile editing, verification approvals, student, college and room management, plus the super-admin-only **Home Page** tab.
- **Dark mode:** toggle in the sidebar (and on the sign-in page). Your choice is remembered.

## Built-in rooms: General and college Lobbies

- **General:** a global room created automatically at the first sign-up. Everyone who is signed in can see and post in it, and it opens by itself on a new person's first visit to Chat (on desktop). If a super admin deletes it, it does not come back.
- **College Lobby:** every college gets a room called "<College> Lobby" the first time anyone chooses (or is verified for) that college. **Choosing your college on your profile is enough** to see and post in it; verification is not needed. Change your college and the old Lobby closes and the new one opens. Lobbies appear in the college list of rooms and have a 6-digit code like any room.
- **Verified-only college rooms are unchanged:** rooms made by officers or admins for a college still need verification. The Lobby is the open entry room; those are the private ones.
- Existing installs: on the next start General is added (unless a global room already exists) and a Lobby is created for each college that already has students. Code: `server/defaultRooms.js`; rooms are marked with `chat_rooms.system_key` (`general` or `lobby`).

## Who sees which chat, and room codes

| Room type | Who can see and post | Who can join with its code |
|---|---|---|
| **Global** | Everyone who is signed in | Everyone |
| **College** | Only **verified** students of that college (website admins can also see them, to moderate) | Only verified students of that college |
| **Private** | Only people who joined with the code (the creator is a member automatically) | Anyone who has the code |

- **Room codes:** every room (global, college and private) gets a random **6-digit code**, shown in the chat header with a copy button. Share it so others can join: click the **key** button above the room list, type the code, done. A private room only becomes visible to a person once they join with its code.
- **New code:** the room's creator (and, for college rooms, a secretary and above; and website admins) can press the refresh button next to the code. The old code stops working; people already in the room stay in.
- **Guessing is limited:** after 10 wrong codes in 10 minutes a person has to wait. A college code typed by someone outside that college gives the same "no room found" answer as a wrong code, so codes can't be used to discover rooms.
- **Choosing a college is not enough.** A student must be **verified** for that college. If a verified student switches their college on their profile, the verified flag is removed until the new college verifies them, and the old college's chats close immediately (including live messages).
- Existing rooms get their codes automatically on the next start.
- **Global rooms** can only be created by website admins. Anyone can create a private room, and verified students can create a room for their own college.
- **Private room members:** the **Members** button (people icon) in a private room's header lists who is in it. The owner (and website admins) can remove people, and everyone else can **Leave room**. The owner cannot leave (delete the room instead). People who were removed can rejoin with the code, so press **New code** if you want to stop that.
- **Chat history:** a room opens on its **newest** 50 messages; press **Load older messages** at the top to go further back.
- **Email addresses are private.** You see your own; website admins see everyone's; college officers see the people of their own college (members and students who asked to be verified there). Everyone else sees no email, including in member lists and message sender cards.

### Who can verify students

- Website admins: any college.
- **College officers** (committee head, secretary, vice president, president): only students who requested **their own college**, and never their own request. They approve or reject under **Profile > Verify students**. The server checks this in `server/verify.js`, not just the interface.
- To limit this to higher ranks, change `VERIFY_MIN_RANK` in `server/policies.js` (and the same line in `src/lib/collegeRoles.ts`), for example to `COLLEGE_RANK.secretary`.
- The first officer of a college has to be given their rank by a website admin (Admin Panel > Students).
- **Automatic verification by college email:** a student whose *confirmed* email domain exactly matches the domain registered for exactly one college is verified without anyone approving them. Setup and rules: `COLLEGE_EMAIL_VERIFICATION_SETUP.md` (logic in `server/collegeEmail.js` and `server/emailConfirm.js`; test with `npm run test:college-email`).

## New-user guide

- **First sign-in:** a short guide opens once with three steps: **1. Choose your college**, **2. Request verification**, **3. Join a room with a code**. Every step can be skipped, and the guide can be closed at any time. People who already had an account before this feature do not see it.
- **The chat page no longer looks empty.** When no room is open, new people see a "Welcome" panel with the same three steps (with their progress: chosen, waiting for approval, verified) and quick buttons for the global rooms. Once someone is verified it becomes a short "Pick a room" message with a Join-with-a-code button. The note above the room list has a button that reopens the guide at the right step.
- **Waiting for approval:** while someone is not verified, their profile is re-checked every minute and when they come back to the tab. When an officer or admin approves them, their college chats appear without reloading.
- **One request at a time:** a person can have only one verification request waiting for approval. After a rejection they can ask again.
- The guide is in `src/components/onboarding/` (`OnboardingWizard.tsx` and `GettingStarted.tsx`). The "finished" flag is `profiles.onboarding_done`.

## Admin dashboard

**Admin Panel > Dashboard** is the first tab (website admins only). It refreshes every minute, and the period (7, 14 or 30 days) can be changed at the top.

| Card | What it counts |
|---|---|
| **New signups** | Accounts created in the chosen period (the total number of accounts is shown underneath) |
| **Pending verifications** | Verification requests waiting for approval right now. Click to open the Verifications tab |
| **Active rooms** | Rooms where at least one message was sent in the chosen period (total rooms underneath). Click to open the Chat Rooms tab |
| **Open reports** | Reported messages still waiting for a moderator. Several reports on one message count once, the same as the red badge on the moderators' queue |

- **Daily activity chart:** one bar per day for the chosen period. Switch between **Messages**, **Signups** and **Reports**; hover a bar to see that day's number. Each metric has its own scale, so signups are not flattened by message counts.
- **Days follow your timezone:** the browser sends its offset from UTC and the server cuts each day at your local midnight.
- **Access:** the server refuses anyone who is not a website admin (`server/dashboard.js`, route `POST /api/admin/dashboard`), whatever the browser asks for. The screen is `src/components/admin/Dashboard.tsx`. No database changes are needed.

## Reporting messages (and the moderators' queue)

Anyone can report a message in a room they can see: hover the message and press the **flag** button, pick a reason (spam, harassment, hate or abuse, inappropriate content, something else), optionally add details, and send. You cannot report your own messages, you can report a message only once, and there is a limit of 10 reports per hour.

| Room type | Who sees the report |
|---|---|
| **College** | Secretary and above of that college, the committee head who created the room, website admins. Never officers of another college |
| **Private** | The room owner and website admins |
| **Global** | Website admins only |

- **The queue:** moderators get a **shield button** above the room list with a red count of open reports (it updates live). It opens **Reports**: one card per reported message, oldest first, with the message, who wrote it, and every report on it (reason, reporter, details). People who report the same message are grouped on one card.
- **One-click actions:** **Delete** the message, **Mute** (10 min, 1 hour, 1 day or 7 days) or **Ban** (permanent, 1, 7 or 30 days) the author, or **Dismiss** the report. For Mute and Ban a checkbox decides whether the message is deleted too (on by default). One click handles every report on that message. The **Handled** tab shows what was done and by whom.
- **Same rules as the commands:** the buttons use the same code and checks as `/mute`, `/ban` and `/clear` (`server/commands.js`). You can only act on people ranked below you, nobody can act on themselves, and the ranks the super admin set under Chat commands still apply. A button you may not use is greyed out with the reason as a tooltip, and the server refuses it anyway.
- **Log:** mutes and bans from the queue appear in the moderation log with the reason "Reported: ...".
- **Privacy:** the reported person is not told who reported them. The text of a message is copied into the report, so it can still be reviewed after the message is deleted. Live updates carry no message text and go only to that room's moderators. Website admins can see reports from every room, including private ones.
- Code: `server/reports.js`, table `message_reports` in `database/schema.sql`, screens in `src/components/chat/Reports.tsx`. Existing databases get the new table automatically on the next start.

## Chat: photos, videos, files and polls

Click the **paperclip** next to the message box:

| Option | What it does |
|---|---|
| Photos | Pick one or more pictures. They show inside the chat; click one to open it full screen (with a download button) |
| Videos | Pick one or more videos. They play inside the chat with a seek bar |
| File | Send any document (PDF, Word, Excel, zip, audio...). Others click it to download. Audio files get a player |
| Poll | Ask a question with 2 to 10 options, optionally allowing several answers. Everyone in the room votes with one click and sees live results |

- You can also **drag and drop** files onto the chat, or **paste** a screenshot into the message box.
- Picked files appear as small previews above the message box. Type a caption if you like, then press send. Up to 10 files at once, **50 MB each** (change with the `MAX_UPLOAD_MB` environment variable).
- Click a vote again to take it back. You can change your vote until the poll is closed. The person who made the poll (and moderators) can **close or reopen** it.
- Programs and scripts (`.exe`, `.bat`, `.sh`, `.msi`...) cannot be sent.
- Deleting a message deletes its file from the disk. Deleting a room deletes all of its files and polls.
- Files are only available to people who can see the room they were sent in, including private rooms.
- Uploaded files are stored in **`database/uploads/`**, next to `campusconnect.db`. Back up both together. Existing databases are upgraded automatically on the next start.

## Profile details: degree, branch, year, phone... (fields added by the super admin)

Every person can fill in extra details under **Profile > Edit Profile > Academic & contact details**. The starter fields are **Degree**, **Branch**, **Year of study**, **Phone number** and **Roll number**.

The super admin controls which fields exist in **Admin Panel > Profile Fields**:

| Action | How |
|---|---|
| Add a field | **Add field**, give it a name and a type: short text, long text, number, **dropdown list** (you type the choices, one per line, e.g. all your degrees or branches), phone number or date |
| Edit | Rename, change the dropdown choices, switch required on or off, change who can see it. The type of an existing field cannot be changed |
| Reorder / delete | Arrows reorder; deleting a field also deletes what people entered in it |
| Visibility | **Everyone**: shown when someone clicks a name in chat. **Admins only**: seen just by the person and website admins (the default for phone and roll number) |
| Required | People must fill it in to save their profile |

Values are checked by the server (phone numbers, dates, numbers, dropdown choices) and private fields are never sent to other people. Data lives in the `profile_fields` and `profile_values` tables.

## Controlling the Home page (super admin)

Sign in as the super admin (the first account created), open **Admin Panel > Home Page**:

| Section | What you can do |
|---|---|
| Page settings | Edit the title and subtitle, switch the slideshow, events, images and videos sections on or off, set how many events show |
| Slideshow | Add slides (image URL, title, subtitle, optional button to Events, Gallery, Colleges or Chat), reorder, hide, delete |
| Images & videos | Add or delete images and videos (by URL), hide any item from the Home page. The Gallery uses the same items |
| Events | Hide any upcoming event from the Home page, or delete any event |

Regular students and normal admins can view the Home page but cannot change it. This is enforced in the database (row-level security), not just in the interface.

Images and videos are added by URL (for example a link to a hosted image or an .mp4 file).

## College ranks (president, vice president, committee head...)

College ranks are separate from the website-wide role (student / admin / super admin). A rank only counts **inside the person's own college**, and only while they are **verified** there. Nobody with a college rank can touch another college or the rest of the website.

| Rank | What they can do (own college only) |
|---|---|
| President | Everything below, plus give vice president, secretary and committee head ranks. One per college |
| Vice president | Secretary powers, plus give secretary and committee head ranks (cannot touch the president or other vice presidents) |
| Secretary | Edit and delete any college room, remove any message in the college's rooms |
| Committee head | Create college rooms and edit, delete and moderate the ones they created. Has a committee name, e.g. "Cultural" |

- **Who gives ranks:** website admins and the super admin can give any rank in any college (Admin Panel > Students, for verified students who have a college). The president and vice president manage their team from **Profile > College Team**.
- **Where you see them:** a rank badge next to the name in chat and on the profile, and the sidebar label.
- **Chat:** officers get Edit and Delete room buttons in the chat header, and a remove button on other people's messages, for the rooms they are allowed to manage. Website admins can still delete any room or message.
- A rank is removed automatically if the person changes college or loses verification.
- All of this is enforced by the server in `server/policies.js`, not just hidden in the interface. Existing databases are upgraded automatically on the next start (two new columns on `profiles`: `college_role`, `committee_name`).
- Creating a college room is now limited to your own college (admins can pick any college).

## Chat commands: /help, /mute, /kick, /ban, /warn, /slowmode, /lock, /pin, /announce, /clear

Type `/` in the message box to see the commands. `/help` (or the **?** button in the chat header) opens a help panel that shows your role in that room, the commands you can use, and the ones that are locked for you with who can use them.

| Command | What it does |
|---|---|
| `/help [command]` | Open the help panel (or explain one command) |
| `/mute @name [time] [reason]` | They can read the room but not post, for a while. No time given = 10 minutes |
| `/unmute @name` | Let them post again |
| `/kick @name [reason]` | Remove them. In a **private** room they can come back with the code. In **college and global** rooms they are kept out for 10 minutes |
| `/ban @name [time] [reason]` | Remove them and block them from coming back (even with the code). Permanent unless you give a time |
| `/unban @name` | Lift a ban or kick. In a private room they still need the code to join again |
| `/bans` | List who is banned, kicked or muted in the room right now |
| `/warn @name reason` | A recorded warning (a reason is required). The **3rd** warning in a room mutes them automatically for 1 hour and their count starts again |
| `/slowmode 30s` | Each person can post once per 30 seconds (`30s`, `2m`, `1h`, up to 6 hours). `/slowmode off` turns it off; `/slowmode` alone shows the current setting. Useful during events |
| `/lock` and `/unlock` | While locked, only officers can post. Everyone can still read. Good for announcements |
| `/pin [n]` and `/unpin` | Pin the latest message (or the nth latest, `/pin 2`) to the top of the room. One pin per room; pinning another replaces it |
| `/announce text` | Post a highlighted notice in **every room of the college** (a private room: just that room; a global room: every global room, website admins only) |
| `/clear 20` | Delete the last 20 messages in the room (1 to 100), files included. Cannot be undone |

- **Naming people:** type `@` after the command and pick from the suggestions (press **Tab** for the first one). Spaces become `_` (`@Priya_Sharma`), or use quotes (`@"Priya Sharma"`). If two people have the same name the suggestion adds a short code, such as `@Priya_Sharma#a1b2`.
- **Time (mute and ban):** `10m`, `2h`, `1d`, `1w`, `1d12h`, or `perm`. 1 minute to 365 days. `/slowmode` uses seconds, minutes or hours (`30s`, `2m`, `1h`).
- **Examples:** `/mute @Priya_Sharma 30m spamming`, `/ban @Priya_Sharma 7d harassment`, `/kick @Priya_Sharma`.
- **Normal messages that start with a slash:** type two, `//like this`, and one slash is sent.
- Everyone in the room sees a line such as "Priya was muted for 30 minutes by Sanjay". The reason is shown only to the person and to moderators. The person you act on sees a banner, a banned person is taken out of the room straight away, and a muted person's message box shows when the mute ends.

**Who can use what, by default** (decided by the server in `server/commands.js`, so it cannot be bypassed from the browser; the super admin can change any of these, see below):

| Who | Where | Commands |
|---|---|---|
| Super admin / website admin | Every room | All of them |
| President, vice president, secretary | The rooms of their own college, while verified | All of them |
| Creator of a college room (committee heads included) | That room | Everything except `/ban`, `/unban` and `/announce` |
| Owner of a private room | That room | All of them |
| Everyone else | | `/help` only |

- **You can only act on people ranked below you** in that room. A secretary cannot touch the president or another secretary, nobody can act on themselves, only the super admin can act on a website admin, and the super admin cannot be banned, muted or kicked.
- A ban or mute can only be lifted by someone at least as senior as whoever issued it.
- **Officers are exempt from slowmode and can post in a locked room:** anyone with moderation power in the room, plus every verified officer (committee head and above) of that room's own college. Everyone else is held to both. The checks run on the server for every message, file and poll.
- **/slowmode, /lock, /pin and /clear** show in the room for everyone straight away: a bar under the header shows the pin, the lock and the slowmode, and each change leaves a line in the chat. **Announcements** appear as a highlighted card. A room's slowmode and lock can only be changed with the commands, not by editing the room.
- **Warnings** are stored per room in `room_warnings`; the three that trigger an automatic mute are marked as used. The automatic mute can be lifted with `/unmute` by anyone at least as senior as the person who gave the third warning.
- **Global rooms:** only website admins can moderate them (there is no college to give anyone a rank).
- **What a ban or kick does:** the room disappears from the person's list, they cannot read or post, and polls and files in it are closed to them. **A mute** only stops posting (messages, files, polls); they can still read and vote. Everything is checked on the server for every request.
- **Changing who can use which command:** the **super admin** opens **Admin Panel > Chat commands** and picks the lowest rank for each command (Everyone, Room creator, Secretary, Vice president, President, Website admins, Super admin only). It takes effect immediately, open chats refresh their help panel, and the reset button next to a command restores its default. `/help` is always open to everyone, and commands that act on people (`/mute`, `/kick`, `/ban`, `/warn` and their undo commands) cannot go below room creator, because nobody can act on someone of the same rank. The server rejects everyone but the super admin. The defaults live in `COMMANDS` in `server/commands.js`; changed ranks are stored in the `command_permissions` table. The warning limit and the automatic mute length are `WARN_LIMIT` and `WARN_MUTE_MIN` in the same file.
- History is kept in the `room_sanctions` table (who, what, when, why, who lifted it). Warnings go in `room_warnings`; slowmode, lock, pins and announcements use new columns on `chat_rooms` and `messages`. Existing databases are upgraded automatically on the next start.

## Moderation log

A read-only history of every **ban, mute, kick and warning**, newest first, built from the `room_sanctions` and `room_warnings` tables (nothing is stored twice).

- **Website admins and the super admin:** **Admin Panel > Moderation log**. Every room, including global and private ones, with a college filter.
- **Presidents and vice presidents:** a **College moderation log** card on their **Profile** page, covering the college rooms of their own college only (never private or global rooms, and never another college). The server decides the scope from the person's current rank, so asking for another college returns nothing extra.
- Each row shows who it was against, the room, who issued it and when, the reason, and where it stands now: in force (until when, or permanent), ended by itself, **lifted by** someone, or for warnings, counting towards the automatic mute or already used up by it.
- Filter by action, show only what is **still in force**, and search by person, moderator, room or reason. Long histories load 50 at a time.
- Endpoint: `POST /api/moderation/log` (`server/modlog.js`).
- **What it does not record:** `/slowmode`, `/lock`, `/unlock`, `/pin`, `/unpin`, `/announce` and `/clear` leave no history, and a lifted ban or mute appears as "lifted by" on the original entry rather than as its own line. Deleting a room or a person's account deletes their log entries with it.

## Missing colleges, CSV import and logos

**Students: "My college is not listed".** On the **Colleges** page press **Request college** (also offered when a search finds nothing, and in the new-user guide under "My college isn't listed"). Fill in the name, and the city, state, country and website if known. A student can have up to **3 requests waiting**, can withdraw one, and sees the answer (Waiting / Added / Not added) in the same window. A name that is already in the directory, or already requested, is refused.

**Admins: Admin Panel > College requests.** Each request shows who asked and the note. **Review** lets you correct the details and pick a tier, then **Add college** creates it; **Reject** closes it. Add the logo afterwards in the Colleges tab. The number of waiting requests shows on the tab. The student then chooses the new college on their profile and asks to be verified as usual (approving a request does not verify anyone).

**Admins: import from CSV.** Admin Panel > Colleges > **Import CSV**. Press **Template** for an example file.

| Column | Notes |
|---|---|
| `name` | Required. A college whose name already exists (any capitals) is skipped, and so is a repeat inside the file |
| `domain`, `city`, `state`, `country` | Optional, 80 characters at most each |
| `tier` | `Tier 1`, `Tier 2` or `Elite` (`1`, `2` and `elite` also work). Anything else is reported as a problem |
| `description` | Optional, 300 characters at most |
| `logo_url` | Optional web link (`https://...`) |

The first row must be the header; columns can be in any order and common names such as `college`, `website` or `logo` are understood. Commas, semicolons and tabs all work as separators. The file is **checked first and nothing is saved** until you press **Import**: you see how many will be added, how many already exist and which rows (with row numbers) have a problem; good rows are imported even when others are not. Up to 2000 rows and 1 MB per import.

**Logos.** In the college form (Admin Panel > Colleges > edit) either **upload a picture** (PNG, JPG, GIF or WebP, 512 KB at most; SVG is not accepted) or paste a **link**. Logos show in the directory, the college window, the admin list and the new-user guide; when there is none, or a link is broken or offline, the building icon is shown. Uploaded pictures are stored in **`database/logos/`** (one file per college; back it up with the database, or set `CAMPUSCONNECT_LOGOS`). Logos are public directory data, so they load without signing in. A deleted college loses its picture too.

## College-only events

When posting an event, college officers (committee head and above, verified) see **Who can see this event?** with **Everyone** or **My college only**. Website admins can pick any college.

- A college-only event is seen only by **verified students of that college**, website admins and the person who posted it. Everyone else does not see it on the Events page, on the Home page or anywhere else.
- Cards show a lock label. Officers can only choose their own college; a plain student cannot create a college-only event.
- If a student stops being verified or changes college they stop seeing the college's events immediately, the same as college chats.
- The rule is enforced by the server in `server/policies.js` (`events` and `checkEventVisibility`), not just in the interface. Existing events stay visible to everyone. If a college is deleted, its college-only events stay hidden from everyone except admins and the poster.

## Run locally in VS Code

1. Install [Node.js](https://nodejs.org) **22.13 or newer** (the database uses Node's built-in SQLite, so nothing else to install).
2. Open this folder in VS Code (`File > Open Folder`) and open the integrated terminal (`View > Terminal`).
3. Install dependencies (Tailwind is pinned to 3.4.17, so don't install Tailwind separately):
   ```bash
   npm install
   ```
4. Start the database server and the website together:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173 and sign up. The first account created becomes `super_admin`.

No internet, accounts or `.env` file are needed. (Images in the starter gallery and slideshow are links to the web, so they only show while online. Add your own image URLs in Admin > Home Page.)

## Where your data is stored

Everything lives in one file inside the project: **`database/campusconnect.db`** (SQLite).

| What | Table |
|---|---|
| Accounts and sessions | `users`, `sessions` (passwords are stored as salted scrypt hashes) |
| Profiles, roles, college ranks, verification | `profiles` (`role`, `college_role`, `committee_name`), `verifications` |
| **Chat messages and rooms** | `messages`, `chat_rooms` (with `room_code`), `room_members` |
| Bans, mutes and kicks | `room_sanctions` |
| Extra profile fields and values | `profile_fields`, `profile_values` |
| Chat files and polls | `uploads` (file records, bytes in `database/uploads/`), `polls`, `poll_options`, `poll_votes` |
| Colleges, college requests and events | `colleges` (with `logo_url`), `college_requests`, `events` (with `visibility`) |
| Home page, slideshow, gallery | `home_settings`, `home_slides`, `media_items` |

- The file and its tables are created automatically on first start from `database/schema.sql`, with starter Home page content from `database/seed/`.
- Uploaded college logos are in `database/logos/`, next to `database/uploads/`.
- Chat history is saved in `messages`, so it is still there after you restart the server or the computer.
- **Back up or move your data** by copying `database/campusconnect.db` (stop the server first). **Start fresh** by stopping the server and deleting that file; a new empty one is created on the next start.
- Open the file with any SQLite viewer (for example the "SQLite Viewer" VS Code extension or DB Browser for SQLite).
- Access rules (who can read, post, edit or delete what) are enforced by the server in `server/policies.js`, the same rules the old Supabase row-level security applied.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the database server (port 3001) and the website (port 5173) |
| `npm run server` | Start only the database server |
| `npm run client` | Start only the website |
| `npm run build` | Production build into `dist/` |
| `npm start` | Build, then serve the website and the API together on http://localhost:3001 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check the project |

Optional environment variables for the server: `MAX_UPLOAD_MB` (default 50), `CAMPUSCONNECT_UPLOADS` (folder for chat files), `CAMPUSCONNECT_LOGOS` (folder for college logos), `PORT` (default 3001), `HOST` (default 127.0.0.1, this computer only), `CAMPUSCONNECT_DB` (use a different database file).

## Project structure

```
src/
  components/   chat/ChatExtras (attachments, polls), chat/RoomCodes (room code and join box), chat/CommandHelp (help panel, command suggestions, moderation notices), CollegeVerifications, Layout, Slideshow, MediaCard, Lightbox, RankEditor, CollegeTeam, CollegeLogo, CollegeFormModal, RequestCollegeModal, admin/HomeManager, admin/CollegeRequestsPanel, admin/CollegeImportModal
  context/      AuthContext, ThemeContext
  data/         Built-in sample media (used only if the database tables are missing)
  lib/          Local API client (supabase.ts keeps the same query style), types, content helpers, collegeRoles.ts (rank helpers), csv.ts (college CSV reader)
  pages/        Auth, Home, Chat, Messages, Colleges, Events, Gallery, Profile, Admin
database/      campusconnect.db (your data), schema.sql, college_roles.sql, seed/
server/        Local server: auth, data API, access rules, realtime chat, dm.js (direct messages and blocking), uploads.js (chat files), chat.js (polls), rooms.js (room codes), commands.js (all the chat commands and who may use them), modlog.js (the read-only moderation log), power.js (a person's authority in a room), sanctions.js (ban and mute lookups), verify.js (college verification), profileFields.js (profile details), colleges.js (college requests, CSV import, logos)
scripts/       dev.mjs (runs server + website)
supabase/migrations/   Old online Supabase schema (kept for reference, no longer used)
```

Imports use the `@/` alias for `src/` (for example `@/lib/supabase`).

## Recent UI improvements

- **Quick navigation palette:** use `Ctrl+K` (or `Cmd+K` on macOS) to search and jump to pages available to your account. Press `Escape` to close it.
- **Home quick actions:** the home page now includes shortcuts to Chat, Messages, Colleges, and Profile.
- **Runtime data hygiene:** the local SQLite database and uploaded runtime files are ignored by Git so user data is not accidentally committed. The server creates the database from `database/schema.sql` and seed files on first run.

The uploaded source bundle was updated with these changes. Run `npm ci`, then `npm run typecheck`, `npm run lint`, and `npm run build` in an environment with registry access before deployment.


## Campus community upgrade

The Community page adds five modules: a student feed (posts, comments, reactions), club creation and membership, event RSVPs and notifications, a campus marketplace, and student discovery. These modules use authenticated `POST /api/features` actions and are stored in SQLite. New tables are created idempotently at server startup in `server/db.js`, so existing databases are upgraded without manually editing them.

### New feature files
- `src/pages/CommunityPage.tsx` — UI for community feed, clubs, event RSVPs, notifications, marketplace, and student discovery.
- `server/features.js` — server-side validation, data access, ownership checks, and feature actions.
- `server/db.js` — idempotent schema additions for posts, comments, reactions, clubs, memberships, RSVPs, notifications, and listings.

Run `npm ci`, then `npm run dev`. Check with `npm run typecheck`, `npm run lint`, and `npm run build`. Marketplace listings and student profile details are visible to signed-in users; do not publish private contact details in public fields. Before production launch, add formal abuse/report workflows for new content, automated tests, backups, and rate limits for posting and listing creation.


## UI refresh

The current UI includes a refreshed responsive app shell, a persistent page header with quick navigation, a polished sidebar and profile controls, updated community and events hero sections, refined cards and form focus states, and responsive spacing for smaller screens.

## Campus Hub additions

The Campus Hub adds study groups, campus opportunities, lost-and-found posts, cross-campus search, and user safety controls. Students can upload images to group/opportunity/lost-and-found posts and set a profile photo. Administrators can review and resolve user reports from the Hub's Safety & Privacy section. These features use idempotent SQLite table creation in `server/db.js`, and uploaded Hub images are shared only through authenticated file access.

Existing UniLink modules already include direct messages, chat polls, profiles, events, the community feed, and the admin dashboard. Those remain accessible from the main navigation.

## Latest chat, UI, and security polish

This update adds a live typing indicator and room read receipts to chat. Typing presence is transient and is never written to the database; the server checks room visibility before broadcasting it. Read receipts use the existing `room_reads` table and are limited to people who can see that room. The chat room list, header, message history, and composer keep independent layout/scroll behavior, with additional responsive and keyboard-focus styling.

Security hardening in this update adds conservative in-memory rate limiting to sign-in/sign-up attempts, baseline browser security headers, and a stricter resolved-path check for static files. Existing upload size/type checks, authenticated API endpoints, room visibility rules, and moderation controls remain in place. The in-memory rate limiter resets when the server restarts; deployments behind a reverse proxy should configure the proxy's own rate limits as well.

After installing dependencies, run `npm run typecheck`, `npm run lint`, and `npm run build` before deployment. Do not expose the development server directly to the public internet without HTTPS, proxy-level protections, and backups for `database/campusconnect.db` and uploaded files.

Chat enhancements also include searching the messages currently loaded in a room, replying to a message with a visible quote, and emoji reactions (👍 ❤️ 😂 🎉 😮 🙏) that sync across room members in real time. Search is intentionally scoped to loaded history; use **Load older messages** before searching older content.

The chat header also includes a local read-receipt preference toggle. Turning it off stops sharing your read position and removes your previously shared receipt rows; the preference is stored in this browser. This does not change message delivery.

### UniLink Helper chatbot

The built-in helper includes guided answers for app navigation, college/global visibility, community posts, marketplace safety, study groups, opportunities, and notifications. It also shows message timestamps, lets users copy answers and rate them, offers suggested questions, and recovers gracefully if a lookup fails. College directory/Wikipedia lookups require an internet connection. The helper is rule-based, not a generative AI service.


## New student productivity, AI, and marketplace features

- **Student planner:** authenticated, per-account tasks with due dates, priority, and todo/in-progress/done status.
- **Saved marketplace listings:** search active listings and save them for later.
- **Admin operational metrics:** the admin dashboard also summarizes community posts, active marketplace listings, upcoming events, and study groups.
- **AI assistant:** configure an OpenAI-compatible provider on the server with `AI_API_KEY`, optional `AI_BASE_URL`, and `AI_MODEL`. Copy `.env.example` to `.env`, set credentials there, and restart the server. The API key is never sent to the browser. If no key is configured or the provider is unavailable, the chatbot falls back to its built-in campus guidance. AI requests are authenticated, rate-limited, capped in length, and time-limited. Do not paste private student information into AI conversations.

## Production and maintenance checklist

1. Use HTTPS and set `HOST`/`PORT` appropriately for your deployment. Keep `.env`, database files, and uploads out of version control.
2. Configure a persistent, access-restricted volume for `database/campusconnect.db` and the upload directory. Back up the SQLite database regularly and test restoring a backup.
3. Set a strong, unique AI provider key only in the server environment; never put it in Vite variables or frontend code. Monitor provider usage and costs.
4. Before public launch, run `npm ci`, `npm run check`, `npm run typecheck`, `npm run lint`, and `npm run build`. Test account permissions and college/global visibility using separate test accounts. Use `npm run backup` for an SQLite snapshot and periodically test restoring it.
5. Use a reverse proxy for HTTPS, request-size limits, and trusted IP handling. The built-in rate limiter is in-memory and intended for a single app process; use shared rate limiting if you scale to multiple instances.

## Functional verification and deployment

- `GET /api/health` is available for host health checks and verifies the SQLite connection.
- Friend request, acceptance, and rejection actions create persistent notifications for the other user.
- `npm run smoke-test` exercises signup, message privacy, friendships, notifications, direct messages, planner persistence, and community-feed visibility against a temporary database.
- The API binds to `0.0.0.0` by default for hosted services; set `HOST=127.0.0.1` for local-only binding.
- **Production hosting must provide a persistent writable disk.** The app stores users, chat, uploads, and campus content in SQLite; ephemeral storage loses data on restart.

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for deployment requirements, verification commands, backup guidance, and known boundaries.
