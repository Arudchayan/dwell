# Overstay Privacy Policy

Last updated: 2026-11-20

Overstay is a browser extension that tracks how much active time you spend on each website and lets you set daily limits. This policy describes what Overstay stores and how you control it. It is also suitable for use as the privacy policy in browser store listings.

## Summary

- Overstay stores all of its data on your device, in your browser's local extension storage (`browser.storage.local`).
- Overstay does not send any data anywhere. It makes no network requests.
- Overstay has no analytics, no tracking, no advertising, no remote code, and no accounts.
- Overstay does not collect, sell, share, or transfer personal data.

## What Overstay stores

Overstay stores the following data locally:

- **Time per domain.** The number of active seconds spent on each base domain (for example, `twitter.com`), recorded per hour of the day. Overstay does not store full URLs, page paths, page titles, or browsing history.
- **Limits.** The sites or groups of sites you define, their daily durations, the weekdays they apply to, and any unlock grace periods you have granted.
- **Settings.** Your idle threshold, day reset hour, data retention period, and strict mode setting.
- **Unlock history.** A count of how many times you have overridden a block each day (the "times you gave in" count).

## What Overstay does not do

- It does not read the content of web pages.
- It does not record URLs, search queries, or browsing history.
- It does not transmit any data to the developer or any third party.
- It does not use cookies or identifiers to track you.

## Permissions

Overstay requests the following permissions. Each one is used only for the purpose listed.

| Permission                            | Why Overstay needs it                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                             | Save your time statistics, limits, and settings locally on your device.                                                                    |
| `tabs`                                | Determine the domain of the active tab so that time is credited to the right website.                                                      |
| `idle`                                | Pause time tracking when you are away from the computer.                                                                                   |
| `alarms`                              | Save data periodically, expire grace periods, and perform the daily reset.                                                                 |
| `notifications`                       | Show limit warnings at 80% of a limit and with 5 minutes left.                                                                             |
| `declarativeNetRequestWithHostAccess` | Redirect a site to the Overstay block page when its daily limit has been reached.                                                          |
| Host access (`<all_urls>`)            | Required so that the redirect in `declarativeNetRequestWithHostAccess` can apply to any site you limit. Overstay never reads page content. |

## Data retention

Overstay keeps time statistics for 365 days by default. You can change the retention period in the settings. Data older than the retention period is removed automatically.

## Your choices

- **View your data.** The dashboard shows the time you have recorded.
- **Export your data.** You can export your data as JSON, or as CSV for spreadsheet tools.
- **Import your data.** You can restore a JSON export.
- **Delete your data.** The dashboard has a **Delete all data** button that removes all stored statistics, limits, and settings from your browser.
- **Remove Overstay.** Uninstalling the extension also removes its local data from your browser.

To delete your data without uninstalling, open the Overstay dashboard and click **Delete all data**. Export first if you want a copy.

## Children

Overstay does not collect personal information from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be published in this repository and the "Last updated" date will change. Any change that would add data collection or network requests would be a breaking change to the promise above and would be announced in the release notes.

## Contact

Questions about this policy can be raised by opening an issue at https://github.com/Arudchayan/overstay/issues. For security concerns, see [SECURITY.md](SECURITY.md).
