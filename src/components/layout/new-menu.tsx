"use client";

import Link from "next/link";
import { ChevronDown, Handshake, Plus, Radio, User, Workflow, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "+ New": contact, deal, broadcast, automation, flow. Each item opens
 * the page's existing create flow (contacts/deals/flows read `?new=1`
 * and open their dialog; broadcasts and automations have /new routes).
 * Creating anything needs the same role as on those pages
 * (send-messages); without it the items are disabled and say why,
 * like GatedButton.
 */
export function NewMenu({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Shell");
  const tGate = useTranslations("GatedButton");
  const canCreate = useCan("send-messages");

  const items = [
    { href: "/contacts?new=1", label: t("new.contact"), icon: User, reason: "addOrImportContacts" },
    { href: "/pipelines?new=1", label: t("new.deal"), icon: Handshake, reason: "createDeals" },
    { href: "/broadcasts/new", label: t("new.broadcast"), icon: Radio, reason: "createBroadcasts" },
    { href: "/automations/new", label: t("new.automation"), icon: Zap, reason: "createAutomations" },
    { href: "/flows?new=1", label: t("new.flow"), icon: Workflow, reason: "createFlows" },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          compact ? (
            <Button size="icon" aria-label={t("new.menuLabel")} />
          ) : (
            <Button className="gap-1.5" />
          )
        }
      >
        <Plus aria-hidden />
        {compact ? null : (
          <>
            {t("new.button")}
            <ChevronDown className="size-3.5 opacity-80" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("new.menuLabel")}</DropdownMenuLabel>
          {items.map(({ href, label, icon: Icon, reason }) =>
            canCreate ? (
              <DropdownMenuItem key={href} render={<Link href={href} />}>
                <Icon className="size-4" aria-hidden />
                {label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={href}
                disabled
                title={tGate("readOnly", { action: tGate(`reasons.${reason}`) })}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
