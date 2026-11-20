# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-11-20

### Changed

- New logo: an old-style serif “O” in ink on paper, with a clay dot that has slipped just past its edge. Toolbar icons, screenshots and store artwork updated.

## [0.2.0] - 2026-11-20

### Changed

- New "calm paper" design: warm paper and ink colours with one teal accent, serif headings (Newsreader) and a humanist sans (Instrument Sans), hairline rules instead of cards. Fonts are bundled, so nothing is loaded from the network.
- Simpler dashboard: **Today**, **History**, **Limits** and **Settings** (data export, import and deletion now live at the bottom of Settings). Old links to Overview, Sites and Your data still work.
- The popup leads with the site you are on and lets you set its limit in one click.
- The block page is calmer and more personal ("Youâve overstayed on â¦"), and the sentence is typed straight under the text.
- Limits are edited in place, with quick allowances (15m, 30m, 1h, 2h) and weekday toggles.
- Durations read "1h" instead of "1h 00m".
- New teal icon and store artwork to match.

## [0.1.1] - 2026-11-20

### Changed

- Renamed the project from **Dwell** to **Overstay**, because another extension called "Dwell" already exists on the Chrome Web Store. The GitHub repository moved to `Arudchayan/overstay` (the old URL redirects).
- Backups exported from Dwell 0.1.0 can still be imported.

## [0.1.0] - 2026-11-20 (released as "Dwell")

### Added

- Active time tracking per website, grouped by base domain. Time counts only while the tab is active, the window is focused, and the user is not idle.
- Dashboard with today, week, and month totals, top sites, a time-of-day heatmap, and a "times you gave in" count.
- Daily limits per site or group of sites, with optional weekday selection.
- Warnings at 80% of a limit and with 5 minutes left, delivered as notifications, plus a toolbar badge.
- Block page for sites that have reached their limit, with a typed unlock sentence that grants a short grace period. Each further unlock on the same day requires a longer sentence.
- Strict mode, which disables overrides.
- Configurable day reset hour (default: midnight).
- Data export and import as JSON, CSV export, and a button to delete all data.
- Configurable data retention (default: 365 days).
- Support for Chrome, Edge, and Brave (Manifest V3) and Firefox 140 and later.

### Privacy

- All data is stored locally in `browser.storage.local`. Overstay makes no network requests, includes no analytics, loads no remote code, and does not require an account.

[Unreleased]: https://github.com/Arudchayan/overstay/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Arudchayan/overstay/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Arudchayan/overstay/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/Arudchayan/overstay/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Arudchayan/overstay/releases/tag/v0.1.0
