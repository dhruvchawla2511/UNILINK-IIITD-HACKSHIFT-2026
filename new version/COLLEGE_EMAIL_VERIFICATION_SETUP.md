# Automatic college email verification

A student is verified for a college automatically when **all** of these are true:

1. They proved they own the email address: by opening the confirmation link we email on sign-up, or by signing in with Google (Google reports the address as verified).
2. The address domain **exactly equals** the domain registered for **exactly one** college (`colleges.domain`).
3. The domain is not a public mail provider (gmail.com, outlook.com, yahoo.com and similar are never trusted).

Gmail (`gmail.com`), including a teacher's personal Gmail address, cannot prove university affiliation and is never treated as a university domain. Everyone else stays in the normal manual verification flow (officers/admins approve under Profile > Verify students). People who are already verified are never changed, and a waiting manual request for the matched college is closed automatically.

## 1. Configure college domains (Admin Panel > Colleges)

Put the official **mail** domain in each college's `domain`, not an email address. `iitd.ac.in`, `https://www.iitd.ac.in/` and `www.iitd.ac.in` all mean `iitd.ac.in`. The app also seeds a small set of separately confirmed institutional email-domain aliases in `college_email_domains` for colleges whose staff email domain differs from their website domain.

- The match is exact. `students.example.edu` does **not** match a college registered as `example.edu`; register the domain students' mail actually uses.
- Only register domains you have checked belong to that college. Starter website domains in `server/collegeSeed.js` are still candidates and should be confirmed as mail domains before relying on them. A few documented aliases are seeded in `server/db.js`; administrators should review them before production use.
- Two colleges with the same domain are ambiguous, so nobody is auto-verified for that domain until one is fixed.

## 2. Set up email sending (Node server, the default)

Add to `.env` (see `.env.example`):

```env
APP_URL=https://your-domain.example      # http://localhost:5173 while using `npm run dev`
RESEND_API_KEY=re_...                    # from resend.com
MAIL_FROM="Unilink <no-reply@your-domain.example>"   # an address on a domain verified in Resend
```

Without `RESEND_API_KEY`/`MAIL_FROM`, outside production the confirmation link is printed in the server console (handy for local testing); in production nothing is sent, so nobody can be verified by email until mail is configured. Password sign-ups can still use the app meanwhile.

## 3. How it behaves

- **Sign-up with a password:** the account works immediately, but its address is unconfirmed. A banner offers "Resend email" (one per minute). Opening the link (24 hours, single use) confirms the address and runs the college check.
- **Google sign-in:** confirmed from the start; the college check runs on every Google sign-in, so a domain added later is picked up.
- **Changing email (Profile > Security):** the new address is unconfirmed until its link is opened; the old links stop working.
- **Existing accounts** are upgraded automatically and start as unconfirmed. Password users confirm via the banner; Google users are confirmed the next time they sign in with Google.
- If an unconfirmed password account exists for an address and its real owner signs in with Google, Google takes the account over and the old password and sessions are revoked.

## 4. Test

```bash
npm run test:college-email
```

starts the server on a spare port with a temporary database and a fake Google endpoint, then checks sign-up, confirmation, `www.`/`https://` normalization, gmail.com, ambiguous domains, email change, resend limits, Google verification and the account takeover case.

Manual check: register with an address at a registered college domain, open the link from the console/email, then look at the profile (college set, verified).

## Supabase deployments only

The Node/SQLite server above is what `npm run dev` / `npm start` run. If you instead run on Supabase Postgres, apply `supabase/migrations/20261017150000_college_email_auto_verification.sql` (SQL Editor or your migration workflow). It uses Supabase Auth's own email confirmation, applies the same rules, backfills confirmed accounts, and locks its helper functions away from the API. It has not been run against a live Postgres here, so test it on a staging project first.
