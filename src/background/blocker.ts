/**
 * Turns "these domains are over their limit" into actual blocking:
 * declarativeNetRequest redirect rules stop new page loads, and tabs that are
 * already open on a blocked site are sent to the block page.
 */
import { browser, type Browser } from 'wxt/browser';
import { domainFromUrl } from '../core/domain';

type Rule = Browser.declarativeNetRequest.Rule;

export const BLOCKED_PAGE = '/blocked.html';

/** URL of the block page for a limit; `url` must stay the last parameter. */
export function blockedPageUrl(limitId: string, originalUrl?: string): string {
  const base = `${browser.runtime.getURL(BLOCKED_PAGE)}?limit=${encodeURIComponent(limitId)}`;
  return originalUrl ? `${base}&url=${encodeURIComponent(originalUrl)}` : base;
}

/** Build one redirect rule per blocked domain. `blocked` maps domain → limit id. */
export function buildRules(blocked: ReadonlyMap<string, string>): Rule[] {
  const page = browser.runtime.getURL(BLOCKED_PAGE);
  return [...blocked.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, limitId], i) => ({
      id: i + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          // \0 is the full request URL; the block page reads everything after `&raw=`.
          regexSubstitution: `${page}?limit=${encodeURIComponent(limitId)}&raw=\\0`,
        },
      },
      condition: {
        regexFilter: '^https?://.*',
        requestDomains: [domain],
        resourceTypes: ['main_frame'],
      },
    })) as Rule[];
}

function sameRules(a: Rule[], b: Rule[]): boolean {
  const key = (r: Rule) =>
    JSON.stringify([r.id, r.condition.requestDomains, r.action.redirect?.regexSubstitution]);
  return a.length === b.length && a.map(key).sort().join() === b.map(key).sort().join();
}

/** Make the dynamic rule set match `blocked`. No-op when nothing changed. */
export async function syncRules(blocked: ReadonlyMap<string, string>): Promise<boolean> {
  const wanted = buildRules(blocked);
  const current = await browser.declarativeNetRequest.getDynamicRules();
  if (sameRules(current, wanted)) return false;
  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: current.map((r) => r.id),
    addRules: wanted,
  });
  return true;
}

/** Send already-open tabs on blocked domains to the block page. */
export async function redirectOpenTabs(blocked: ReadonlyMap<string, string>): Promise<number> {
  if (blocked.size === 0) return 0;
  const tabs = await browser.tabs.query({});
  let count = 0;
  for (const tab of tabs) {
    const domain = domainFromUrl(tab.url);
    const limitId = domain ? blocked.get(domain) : undefined;
    if (tab.id === undefined || !limitId) continue;
    try {
      await browser.tabs.update(tab.id, { url: blockedPageUrl(limitId, tab.url) });
      count++;
    } catch {
      // The tab may have closed in the meantime.
    }
  }
  return count;
}
