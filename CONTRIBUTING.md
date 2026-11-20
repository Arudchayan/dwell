# Contributing to Dwell

Thanks for your interest in improving Dwell. This guide covers how to set up the project, what we expect from changes, and how to submit them.

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting started

Requirements: Node.js 20 or later and npm.

```sh
git clone https://github.com/Arudchayan/dwell.git
cd dwell
npm install
npm run dev
```

`npm run dev` builds Dwell for Chrome and watches for changes. Load the output from `.output/chrome-mv3` as an unpacked extension (`chrome://extensions`, Developer mode). For Firefox, use `npm run dev:firefox` and load the add-on from `about:debugging`.

## Scripts

| Command                 | When to use it                                       |
| ----------------------- | ---------------------------------------------------- |
| `npm run lint`          | Before every commit (ESLint and Prettier)            |
| `npm run typecheck`     | Before every commit                                  |
| `npm test`              | After changing any logic                             |
| `npm run test:coverage` | To check coverage of the code you changed            |
| `npm run test:e2e`      | After changing the blocker, popup, or UI flows       |
| `npm run lint:firefox`  | After changing the manifest or Firefox-specific code |

## Project principles

- **Keep `src/core` pure.** Code in `src/core` (domain, tracker, limits, sentences, stats, schema) must not import browser extension APIs, the DOM, or Preact. Pass time, storage, and other side effects in as arguments so the logic can be unit tested without a browser.
- **Stay local.** Dwell makes no network requests and has no analytics. Do not add code that sends data off the device, loads remote code, or stores URLs or browsing history. Changes to what is stored must be reflected in [PRIVACY.md](PRIVACY.md).
- **Keep permissions minimal.** Do not add a manifest permission without a clear justification in the pull request. Explain why the feature cannot work without it.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short summary>
```

Common types:

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation only
- `refactor`: a code change that neither fixes a bug nor adds a feature
- `test`: adding or updating tests
- `chore`: tooling, dependencies, or other maintenance

Examples: `feat(limits): add weekday selection`, `fix(tracker): stop counting when the window loses focus`.

## Branches and pull requests

1. Fork the repository, or create a branch if you have write access.
2. Branch from `main` using a descriptive name, such as `feat/weekday-limits` or `fix/idle-detection`.
3. Make your changes in small, focused commits that follow the commit message format above.
4. Open a pull request against `main`. Fill in the pull request template.
5. Make sure CI passes. CI runs lint, typecheck, unit tests with coverage, end-to-end tests, and the Chromium and Firefox builds.
6. A maintainer will review your pull request. Please respond to review comments by pushing new commits.

## Tests

Tests are required for behavior changes:

- Logic changes in `src/core`, `src/background`, or `src/storage` need unit tests in `tests/unit` (Vitest).
- Changes to the blocker, the block page, the popup, or the dashboard flows need an end-to-end test in `tests/e2e` (Playwright, Chromium). Extensions run in headed Chromium, so the e2e suite is run under `xvfb-run` in CI.
- Bug fixes should include a test that fails without the fix.

Run `npm test` and `npm run test:e2e` locally before opening a pull request.

## Adding guilt-trip sentences

The unlock sentences are defined in `src/core/sentences`. When you add or edit a sentence:

- Keep the tone honest and light. The goal is a moment of reflection, not shame or cruelty.
- Keep sentences exact and easy to type. Users must type them word for word, so avoid unusual punctuation, curly quotes, and special characters.
- Keep the ordering rule intact. Later unlocks in a day use longer sentences, so new sentences must fit into the existing length tiers.
- Add or update unit tests for sentence selection if you change the number of sentences or the tiers.

## Reporting bugs and requesting features

Use the issue templates. Do not include personal browsing URLs in bug reports. Dwell does not store them, so describing the domain is enough. For security vulnerabilities, do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
