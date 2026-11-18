/**
 * Shared display config for message_templates.status.
 *
 * The DB stores Meta's raw enum (DRAFT / APPROVED / PENDING / REJECTED /
 * PAUSED / DISABLED / IN_APPEAL / PENDING_DELETION) — the UI maps it to
 * a human label + badge classes (AA on white) here so the template manager,
 * inbox picker, and broadcast picker stay aligned.
 */

import type { MessageTemplateStatus } from '@/types';
import { getT } from '@/lib/i18n/translate';

export interface TemplateStatusDisplay {
  label: string;
  classes: string;
}

const t = getT('TemplateStatus');

export const templateStatusConfig: Record<
  MessageTemplateStatus,
  TemplateStatusDisplay
> = {
  DRAFT: {
    label: t('DRAFT'),
    classes: 'bg-slate-600/20 text-muted-foreground border-slate-600/30',
  },
  PENDING: {
    label: t('PENDING'),
    classes: 'bg-yellow-600/20 text-status-warning border-status-warning/30',
  },
  APPROVED: {
    label: t('APPROVED'),
    classes: 'bg-primary/20 text-primary border-primary/30',
  },
  REJECTED: {
    label: t('REJECTED'),
    classes: 'bg-red-600/20 text-status-critical border-status-critical/30',
  },
  PAUSED: {
    label: t('PAUSED'),
    classes: 'bg-orange-600/20 text-orange-700 border-orange-600/30',
  },
  DISABLED: {
    label: t('DISABLED'),
    classes: 'bg-status-critical/10 text-status-critical border-status-critical/40',
  },
  IN_APPEAL: {
    label: t('IN_APPEAL'),
    classes: 'bg-blue-600/20 text-blue-700 border-blue-600/30',
  },
  PENDING_DELETION: {
    label: t('PENDING_DELETION'),
    classes: 'bg-muted text-muted-foreground border-border',
  },
};
