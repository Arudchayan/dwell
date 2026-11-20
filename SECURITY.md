# Security Policy

## Supported versions

Only the latest release of Dwell receives security fixes. Please update to the latest release before reporting an issue, and confirm the issue still occurs on it.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Report them privately using GitHub private vulnerability reporting:

1. Go to the [Security tab](https://github.com/Arudchayan/dwell/security) of the repository.
2. Click **Report a vulnerability**.
3. Describe the issue, the steps to reproduce it, the affected version, and the browser you tested with.

Private reports are visible only to the maintainers. We will acknowledge your report as soon as we can, keep you informed of progress, and credit you in the release notes if you wish.

## Scope

Dwell stores all of its data locally in `browser.storage.local` and makes no network requests. Reports are especially welcome for:

- Any way that data leaves the browser or is read by a site or another extension
- Bypasses of the daily limit or block page that a user could not reasonably expect
- Issues with the permissions Dwell requests, or the way it uses them

Issues that require an attacker to already control the user's browser or device are generally out of scope.
