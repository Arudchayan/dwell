# Store listing copy

Shared copy for the Chrome Web Store and Firefox Add-ons (AMO). Keep this file in sync with the README and PRIVACY.md. The Chrome Web Store field-by-field guide and submission checklist are in [chrome-web-store.md](chrome-web-store.md).

## Name

Overstay — Website Time Tracker & Limits

This comes from `name` in `wxt.config.ts`; the stores read it from the manifest.

## Short description (132 characters maximum)

Know where your time goes. Track active time per website, set daily limits, and keep all your data on your device.

## Full description

Know where your time goes, and when you've overstayed.

Overstay measures the active time you spend on each website, shows you where it goes, and helps you set daily limits for the sites that take more of your day than you intend.

What Overstay does

- Tracks active time per website, grouped by base domain. Time counts only while the tab is active, the window is focused, and you are not idle.
- Shows a dashboard with today, week, and month totals, top sites, a time-of-day heatmap, and a count of how often you gave in to a limit.
- Lets you set daily limits for a single site or a group of sites, such as a "Twitter" group covering twitter.com and x.com, optionally only on certain weekdays.
- Warns you with a notification at 80% of a limit and again with 5 minutes left, and shows a count on the toolbar badge.
- When a limit is reached, redirects the site to a block page. To continue, you type a sentence exactly. Each unlock grants a short grace period, and each further unlock that day requires a longer sentence.
- Offers strict mode, which turns off overrides entirely.
- Lets you choose the hour your day resets, and how long data is kept.
- Exports your data as JSON or CSV, imports JSON, and deletes all data with one button.

Your data stays on your device

Overstay stores everything in your browser's local extension storage. It makes no network requests, includes no analytics, loads no remote code, and does not require an account. Overstay does not store browsing history or URLs. It keeps only the number of seconds spent per domain in each hour of the day.

Open source

Overstay is free and open source under the MIT License. Source code, issues, and contributions are on GitHub: https://github.com/Arudchayan/overstay

## Category

Productivity

## Single-purpose statement

Overstay tracks the active time you spend on websites, shows it to you, and lets you set daily time limits for those websites.

## Permission justifications

| Permission                            | Justification                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Saves your time statistics, limits, and settings in local extension storage on your device. Nothing is sent off the device.                  |
| `tabs`                                | Reads the base domain of the active tab so that active time is credited to the correct website. Overstay does not store URLs or page titles. |
| `idle`                                | Detects when you are away from the computer so that time is not counted while you are idle.                                                  |
| `alarms`                              | Runs periodic saves, expires unlock grace periods, and performs the daily reset at your chosen hour.                                         |
| `notifications`                       | Shows limit warnings at 80% of a limit and with 5 minutes left.                                                                              |
| `declarativeNetRequestWithHostAccess` | Redirects a site to the Overstay block page once its daily limit is reached.                                                                 |
| Host access (`<all_urls>`)            | Allows the block-page redirect to apply to any website you choose to limit. Overstay does not read the content of any page.                  |

## Privacy practices (data disclosure answers)

- Does this extension collect or use user data? **No.** Overstay does not collect, transmit, sell, or share any user data.
- Personally identifiable information: **Not collected.**
- Health information, financial and payment information, authentication information, personal communications, location, web history, user activity (as sent off the device), and website content: **Not collected.**
- Data stored: time statistics and settings are stored only on the user's device, in local extension storage, and are never transmitted.
- Remote code: **No.** All code is included in the extension package.
- Data sale: **No.** Data is not sold to third parties.
- Use or transfer outside the single purpose: **No.** Data is not used or transferred for purposes unrelated to the single purpose, or for creditworthiness or lending.
- Privacy policy: https://github.com/Arudchayan/overstay/blob/main/PRIVACY.md

## Notes for reviewers

- Source code: https://github.com/Arudchayan/overstay (MIT). Build with `npm ci && npm run zip:firefox`; the
  `overstay-<version>-sources.zip` produced next to the add-on zip is the exact source used.
- `web-ext lint` reports one `UNSAFE_VAR_ASSIGNMENT` warning. It comes from Preact's internal support for
  `dangerouslySetInnerHTML`, which Overstay never uses; no user or page content is ever written as HTML.
- The extension never reads page content and makes no network requests. Host access is only used by
  `declarativeNetRequest` to redirect sites that are over their daily limit to the extension's own block page.
