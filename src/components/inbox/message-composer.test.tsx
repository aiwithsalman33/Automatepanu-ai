import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";

/**
 * The redesigned composer must keep the old gating:
 *   - 24h window expired → template-only (free-form tools and the
 *     input are disabled, Template stays available, the hint shows);
 *   - viewer role → read-only (nothing that sends is enabled);
 *   - otherwise everything is enabled.
 * Rendered to static HTML (no DOM library in this repo), so the checks
 * read the disabled state off each control's markup.
 */
const canSend = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-can", () => ({ useCan: () => canSend.value }));

const { MessageComposer } = await import("./message-composer");

afterEach(() => {
  canSend.value = true;
});

function render(props: { sessionExpired: boolean }) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <MessageComposer
        conversationId="c1"
        sessionExpired={props.sessionExpired}
        onSend={() => {}}
        onSendMedia={() => {}}
        onSendInteractive={() => {}}
        onOpenTemplates={() => {}}
        replyTo={null}
        onClearReply={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

/** The opening <button …> tag of the button whose content contains `label`. */
function buttonTag(html: string, label: string): string {
  const buttons = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  const hit = buttons.find((b) => b.replace(/<[^>]+>/g, "").includes(label));
  if (!hit) throw new Error(`no button "${label}" in composer markup`);
  return hit.slice(0, hit.indexOf(">") + 1);
}
const isDisabled = (tag: string) => /\sdisabled(=""|\s|>)/.test(tag) || /aria-disabled="true"/.test(tag);
const textarea = (html: string) => html.match(/<textarea\b[^>]*>/)?.[0] ?? "";

const FREE_FORM = ["Quick replies", "Buttons", "Voice", "Attach"];

describe("MessageComposer gating", () => {
  it("open window, agent: every tool and the input are enabled", () => {
    const html = render({ sessionExpired: false });
    for (const label of [...FREE_FORM, "Template", "AI draft"]) {
      expect(isDisabled(buttonTag(html, label)), label).toBe(false);
    }
    expect(isDisabled(textarea(html))).toBe(false);
  });

  it("expired 24h window: template-only", () => {
    const html = render({ sessionExpired: true });
    for (const label of FREE_FORM) {
      expect(isDisabled(buttonTag(html, label)), label).toBe(true);
    }
    expect(isDisabled(buttonTag(html, "Template")), "Template").toBe(false);
    expect(isDisabled(textarea(html))).toBe(true);
    expect(textarea(html)).toContain(messages.Inbox.composer.sessionExpiredPlaceholder);
    expect(html).toContain(messages.Inbox.composer.sessionExpiredHint);
  });

  it("viewer role: read-only, nothing that sends is enabled", () => {
    canSend.value = false;
    const html = render({ sessionExpired: false });
    for (const label of [...FREE_FORM, "Template", "AI draft", "Send"]) {
      expect(isDisabled(buttonTag(html, label)), label).toBe(true);
    }
    expect(isDisabled(textarea(html))).toBe(true);
    expect(textarea(html)).toContain(messages.Inbox.composer.readOnlyPlaceholder);
    // GatedButton explains why on hover.
    expect(html).toContain("Read-only — your role can&#x27;t send messages");
  });
});
