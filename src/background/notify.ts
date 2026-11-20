import { browser } from 'wxt/browser';
import type { LimitStatus, WarningKind } from '../core/limits';
import { formatBadge, formatDuration } from '../core/time';

const COLORS = {
  ok: '#4f46e5',
  warning: '#d97706',
  grace: '#7c3aed',
  blocked: '#dc2626',
} as const;

export function warningText(
  kind: WarningKind,
  status: LimitStatus,
): { title: string; message: string } {
  const name = status.limit.name;
  switch (kind) {
    case 'eighty':
      return {
        title: `${name}: ${formatDuration(status.remainingMs)} left today`,
        message: `You've used ${formatDuration(status.usedMs)} of your ${formatDuration(status.limit.dailyMs)} limit.`,
      };
    case 'five':
      return {
        title: `${name}: about ${formatDuration(status.remainingMs)} left`,
        message: 'Good moment to wrap up what you are doing.',
      };
    case 'reached':
      return {
        title: `${name} is blocked for today`,
        message: `You reached your ${formatDuration(status.limit.dailyMs)} limit. See you tomorrow.`,
      };
  }
}

export async function showWarning(kind: WarningKind, status: LimitStatus): Promise<void> {
  const { title, message } = warningText(kind, status);
  try {
    await browser.notifications.create(`dwell:${status.limit.id}:${kind}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title,
      message,
    });
  } catch {
    // Notifications can be disabled at the OS level; that's fine.
  }
}

/** Update the toolbar badge for the site in the active tab. */
export async function updateBadge(status: LimitStatus | null, tabId?: number): Promise<void> {
  const text = !status
    ? ''
    : status.state === 'blocked'
      ? '0'
      : status.state === 'grace'
        ? '…'
        : formatBadge(status.remainingMs);
  const details = tabId === undefined ? {} : { tabId };
  await browser.action.setBadgeText({ ...details, text });
  if (status) {
    await browser.action.setBadgeBackgroundColor({ ...details, color: COLORS[status.state] });
  }
}
