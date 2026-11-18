# Auth and invite emails

Sign-in is native (Better Auth, served by the app at `/api/auth/*`). The app sends its own emails over SMTP:

| Email                  | When                                                             | Link goes to                                                                              |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Confirm your email     | sign-up                                                          | `/api/auth/verify-email?token=…` → signs the user in → `/dashboard` (or `/join/<invite>`) |
| Reset your password    | "Forgot password"                                                | `/api/auth/reset-password/<token>` → `/reset-password?token=…` (expires in 1 hour)        |
| Confirm your new email | Settings → Profile, email change (sent to the OLD address first) | `/api/auth/verify-email?token=…`; the new address is then verified the same way           |
| Team invite            | Settings → Members → Invite, when an email is entered            | `/join/<token>` (the invite link the admin can also copy)                                 |

Every link is built from the app origin (`NEXT_PUBLIC_APP_URL`, e.g. `https://chat.axxeler.in`), never from the request's Host header. Better Auth only redirects to that origin.

## Configure SMTP

Set these in Dokploy → Environment (or `.env`):

```env
AUTH_SECRET=<32+ random chars>      # openssl rand -hex 32
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587                       # 465 → also set SMTP_SECURE=true
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM="Automate Panu AI <helpaxxeler@gmail.com>"
```

- **Production refuses to run without SMTP.** Without `SMTP_HOST`, a production server fails each send loudly instead of silently dropping it, so nobody can verify their email. Development (`next dev`) logs each email, link included, to the server console instead.
- **Deliverability.** The `SMTP_FROM` domain needs SPF and DKIM records from your provider. Otherwise verification emails land in spam.
- **Local testing.** Mailpit catches every email:
  ```sh
  docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.27.0
  # SMTP_HOST=localhost SMTP_PORT=1025, then open http://localhost:8025
  ```

## Behaviour worth knowing

- **Verification is required.** Sign-in returns 403 until the address is confirmed. The login page explains this.
- **Resetting a password signs out every session**, and so does "Sign out of all devices" (Settings → Profile). Changing the password from Settings signs out every _other_ device.
- **Rate limits (per IP):** 5 sign-ins per minute, 10 sign-ups per hour, 5 reset requests per hour. They are shared across app instances through Redis.
- **The forgot-password page doesn't reveal whether an address is registered.**
- **Old links.** Links emailed by the previous auth provider before the migration land on `/auth/callback`, which sends the visitor to `/login` with a "this link can't be used" notice.

Tests: `tests/db/email.smtp.test.ts` sends all four kinds through a real SMTP server (Mailpit in CI) and follows the verification link. `tests/db/auth.native.test.ts` covers the flows themselves.
