"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface WhatsAppNumber {
  id: string;
  /** Display form, e.g. "+91 86104 18890". */
  label: string;
}

/** "all" or one number's id. Inbox, Contacts activity, Broadcasts and Home will filter on it. */
export type NumberFilter = "all" | string;

interface NumberFilterValue {
  numbers: WhatsAppNumber[];
  selected: NumberFilter;
  setSelected: (next: NumberFilter) => void;
}

const NumberFilterContext = createContext<NumberFilterValue>({
  numbers: [],
  selected: "all",
  setSelected: () => {},
});

/**
 * Holds the WhatsApp number filter for the whole user panel.
 *
 * Today an account has exactly one number (whatsapp_config is unique
 * per account and conversations don't record a number), so `numbers`
 * is empty and the switcher renders nothing. When multi-number support
 * lands, the shell passes the account's numbers here and pages read
 * `useNumberFilter().selected`.
 */
export function NumberFilterProvider({
  numbers,
  children,
}: {
  numbers: WhatsAppNumber[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<NumberFilter>("all");
  const value = useMemo(() => ({ numbers, selected, setSelected }), [numbers, selected]);
  return <NumberFilterContext.Provider value={value}>{children}</NumberFilterContext.Provider>;
}

export function useNumberFilter() {
  return useContext(NumberFilterContext);
}

/** All numbers or one. Hidden for accounts with fewer than two numbers. */
export function NumberSwitcher({
  numbers,
  selected,
  onSelect,
}: {
  numbers: WhatsAppNumber[];
  selected: NumberFilter;
  onSelect: (next: NumberFilter) => void;
}) {
  const t = useTranslations("Shell");
  if (numbers.length < 2) return null;
  const current = numbers.find((n) => n.id === selected);
  const options: { id: NumberFilter; label: string }[] = [
    { id: "all", label: t("numbers.all") },
    ...numbers.map((n) => ({ id: n.id, label: n.label })),
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="max-w-56 gap-2" aria-label={`${t("numbers.label")}: ${current?.label ?? t("numbers.all")}`} />}
      >
        <Phone aria-hidden />
        <span className="truncate">{current?.label ?? t("numbers.all")}</span>
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("numbers.label")}</DropdownMenuLabel>
          {options.map((o, i) => (
            <div key={o.id}>
              {i === 1 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem onClick={() => onSelect(o.id)}>
                <Check className={o.id === selected ? "size-4" : "size-4 opacity-0"} aria-hidden />
                <span className="truncate">{o.label}</span>
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The switcher bound to the panel-wide filter. */
export function ConnectedNumberSwitcher() {
  const { numbers, selected, setSelected } = useNumberFilter();
  return <NumberSwitcher numbers={numbers} selected={selected} onSelect={setSelected} />;
}
