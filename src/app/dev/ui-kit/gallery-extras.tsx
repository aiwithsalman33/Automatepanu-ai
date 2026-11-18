"use client";

import { useState, type ReactNode } from "react";

import { NumberSwitcher, type NumberFilter } from "@/components/layout/number-switcher";

/**
 * More gallery sections, added as the redesign phases land (shell
 * pieces, inbox rows, …). Kept separate so each phase only appends.
 */

const DEMO_NUMBERS = [
  { id: "n1", label: "+91 86104 18890" },
  { id: "n2", label: "+91 81480 35472" },
  { id: "n3", label: "+91 90030 55555" },
];

function NumberSwitcherDemo() {
  const [selected, setSelected] = useState<NumberFilter>("all");
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Shown only for accounts with two or more WhatsApp numbers (none today: one number per
        account). Demo data below.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <NumberSwitcher numbers={DEMO_NUMBERS} selected={selected} onSelect={setSelected} />
        <span className="text-xs text-muted-foreground">selected: {selected}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">One number (renders nothing):</span>
        <NumberSwitcher numbers={DEMO_NUMBERS.slice(0, 1)} selected="all" onSelect={() => {}} />
      </div>
    </div>
  );
}

export const GALLERY_EXTRAS: { title: string; render: () => ReactNode }[] = [
  { title: "Shell: number switcher", render: () => <NumberSwitcherDemo /> },
];
