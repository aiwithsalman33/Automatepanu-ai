# User-panel redesign: regression checklist

Run before merging each redesign phase. The redesign changes presentation only, so these check that behaviour did not move with the markup.

## 1. Expired 24-hour window: composer is template-only

Automated: `src/components/inbox/message-composer.test.tsx` ("expired 24h window: template-only").

Manual:
1. Open a conversation whose last customer message is more than 24 hours old.
2. The header pill reads "Window closed".
3. The amber hint "24-hour session expired. Use a template to re-engage." shows above the composer, with a Templates button.
4. Quick replies, Buttons, Voice, Attach and the message box are disabled. Template is enabled.

## 2. Viewer role is read-only

Automated: `src/components/inbox/message-composer.test.tsx` ("viewer role: read-only").

Manual, signed in as a member with the Viewer role:
1. Inbox: every composer pill, the message box and Send are disabled. Hovering Template shows "Read-only — your role can't send messages".
2. Top bar "+ New": every item is disabled and its tooltip says why.
3. `/contacts?new=1`, `/pipelines?new=1` and `/flows?new=1` do not open a create dialog.

## 3. New messages reach the open inbox

Live push is not wired up yet: `.channel()` in `src/lib/supabase/client.ts` is a no-op until realtime moves to SSE. This is the same on `main` and is not a redesign change. Until then, the Inbox catches up by refetching when the tab becomes visible again, and when the agent presses Refresh in the thread header.

Manual (local stack):
1. Open a conversation in the Inbox.
2. Insert a customer message for it in the database (or send one to the business number).
3. Press Refresh in the thread header. The message appears in the thread and the list row shows it as the preview.
4. Switch to another tab and back. The list and thread refetch.

When SSE realtime lands, add: the message appears within a few seconds without pressing Refresh.
