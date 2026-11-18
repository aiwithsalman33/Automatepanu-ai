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

**Re-test after checkpoint 1e (realtime moves to SSE).** Live updates must be checked again then, on every page that subscribes: Inbox (list and open thread), Home (refreshes its numbers on new messages), the rail's unread badge, and the bell's unread count. Expected: a new customer message appears within a few seconds without pressing Refresh or switching tabs.

## 4. Deals board: Won | Lost column

Won and lost are deal statuses, not stages. The board shows them in an end column driven by status, with a Won | Lost toggle in its header. There is no sixth column.

Automated: `src/lib/pipelines/board-drop.test.ts` (drop on Won and Lost, reopen by dragging onto a stage, no-op drops, failure handling, the 30-day window).

Manual:
1. Drag an open deal onto the end column while it shows Won. The deal leaves its stage column and appears under Won. The toast reads "Marked as won", the same as the drawer's Mark as won button. The update is the same too. There is no confirmation step: the drawer's button has none today either.
2. Switch the toggle to Lost and drop a deal. It is marked lost ("Marked as lost").
3. Drag a won deal onto a stage. It reopens in that stage ("Deal reopened") and leaves the Won list.
4. Repeat 1 and 3 with the keyboard: focus a card, Space to pick it up, arrow keys to move, Space to drop, Escape to cancel.
5. The end column shows deals closed in the last 30 days. "View all (N)" shows every closed deal on that side; "Show last 30 days" goes back.
6. The analytics strip shows the same numbers as before the redesign. Won and lost this month now share one tile.
7. As a Viewer, dropping changes nothing: the update is refused and the board refetches.
