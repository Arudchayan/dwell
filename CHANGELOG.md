# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-20

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

- All data is stored locally in `browser.storage.local`. Dwell makes no network requests, includes no analytics, loads no remote code, and does not require an account.

[Unreleased]: https://github.com/Arudchayan/dwell/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Arudchayan/dwell/releases/tag/v0.1.0
