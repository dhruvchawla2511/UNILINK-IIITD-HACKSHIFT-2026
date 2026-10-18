# Enable Google login for UniLink

Google login is now available on both the Create Account and Sign In views. It uses Google Identity Services in the browser and verifies the Google ID token on the UniLink server before creating/signing in the user.

## 1. Create a Google OAuth client

1. Open https://console.cloud.google.com/ and create/select a Google Cloud project.
2. Configure the OAuth consent screen / Google Auth Platform branding and audience.
3. Create an OAuth client ID with application type **Web application**.
4. Under **Authorized JavaScript origins**, add your local origin (for example `http://localhost:5173`) and your deployed website origin (for example `https://your-domain.example`). Do not include a path.
5. Copy the client ID. This flow does not need a client secret.

## 2. Configure UniLink

Copy `.env.example` to `.env`, then put the same Web client ID in both variables:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart `npm run dev` after changing `.env`. Vite reads `VITE_GOOGLE_CLIENT_ID` when starting/building the frontend; the server uses `GOOGLE_CLIENT_ID` to verify credentials.

For hosting, set both environment variables in the hosting provider. Set `VITE_GOOGLE_CLIENT_ID` before building the frontend, then redeploy/rebuild.

## Notes

- Google login will show a configuration message until the frontend client ID is set.
- The server rejects tokens whose audience does not match `GOOGLE_CLIENT_ID` or whose email is not verified.
- First-time Google users get a normal UniLink profile and can finish college onboarding after login.
- Existing accounts with the same verified email can sign in with Google without losing their existing profile.
- If that existing account's email was never confirmed (it was registered with a password and the link was never opened), Google sign-in takes it over: the old password and all of its sessions are revoked, because nothing ever proved who typed that address. Use Google (or ask for a new link after signing in) from then on.
- A Google account whose email domain is registered for a college verifies that college automatically (see `COLLEGE_EMAIL_VERIFICATION_SETUP.md`).
