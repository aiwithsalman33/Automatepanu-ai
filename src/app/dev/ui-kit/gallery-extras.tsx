"use client";

import type { ReactNode } from "react";

/**
 * More gallery sections, added as the redesign phases land (shell
 * pieces, inbox rows, …). Kept separate so each phase only appends.
 */
export const GALLERY_EXTRAS: { title: string; render: () => ReactNode }[] = [];
