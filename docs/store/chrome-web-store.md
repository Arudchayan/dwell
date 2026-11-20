# Chrome Web Store submission

Everything needed to publish Overstay on the Chrome Web Store, in the order the developer dashboard asks for it. Copy shared with Firefox Add-ons lives in [listing.md](listing.md); keep both in sync with `README.md` and `PRIVACY.md`.

Policy facts below were checked against the Chrome Web Store documentation on 2026-11-20. Links are in [References](#references).

## 1. Package

Build the upload with:

```sh
npm ci
npm run zip
```

This writes `.output/overstay-<version>-chrome.zip` (v0.1.0: about 226 kB). The same zip is attached to each GitHub release.

### Manifest check (v0.1.0)

| Check                              | Result                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest_version`                 | 3                                                                                                                                                                             |
| `name`                             | `Overstay — Website Time Tracker & Limits` (40 characters). This is the store title, and it can only be changed by uploading a new version.                                   |
| `description` (132 characters max) | 109 characters. Shown as the store summary.                                                                                                                                   |
| Icons                              | 16, 32, 48, 96 and 128 px PNGs in `icon/`. No size larger than 128 px.                                                                                                        |
| Remote code                        | None. All scripts are bundled and loaded from the package; there is no `eval`, `new Function`, remote `<script>`, or `importScripts`.                                         |
| Network requests                   | None. The only `fetch` in the bundle is Vite's module-preload polyfill, which only fetches the extension's own `<link rel="modulepreload">` files.                            |
| URLs in the bundle                 | Only XML namespace strings and the GitHub link in the dashboard footer.                                                                                                       |
| Content scripts                    | None.                                                                                                                                                                         |
| `web_accessible_resources`         | `blocked.html` for `<all_urls>`. Needed so the redirect rule can send an over-limit site to the extension's block page.                                                       |
| Permissions                        | `storage`, `tabs`, `idle`, `alarms`, `notifications`, `declarativeNetRequestWithHostAccess`. Each one is used in `src/` (see the justifications below).                       |
| Host permissions                   | `<all_urls>`. Required for `declarativeNetRequest` redirects (blocking alone would not need it, redirecting does). Broad host access usually means a longer, in-depth review. |

Reviewer note on `tabs`: in Chrome, `<all_urls>` host access already exposes `tab.url`, so `tabs` is partly redundant there. It is kept because Firefox MV3 lets users withhold host access, and Overstay must still read the active tab's domain. It adds no new install warning in Chrome, because "Read and change all your data on all websites" already covers it.

## 2. Store listing tab

### Title

Taken from the manifest: **Overstay — Website Time Tracker & Limits**

### Summary (132 characters max, from the manifest)

Know where your time goes. Track time per website, see charts, and set daily limits. 100% local, no tracking.

### Description

```text
Know where your time goes, and when you've overstayed.

Overstay measures the active time you spend on each website, shows you where it goes, and helps you set daily limits for the sites that take more of your day than you intend.

WHAT OVERSTAY DOES
• Tracks active time per website, grouped by base domain. Time counts only while the tab is active, the window is focused, and you are not idle.
• Shows a dashboard with today, week and month totals, top sites, a time-of-day heatmap, and a count of how often you gave in to a limit.
• Lets you set daily limits for a single site or a group of sites, such as a "Twitter" group covering twitter.com and x.com, optionally only on certain weekdays.
• Warns you with a notification at 80% of a limit and again with 5 minutes left, and shows a count on the toolbar badge.
• When a limit is reached, redirects the site to a block page. To continue, you type a sentence exactly; pasting is disabled. Each unlock grants a short grace period, and each further unlock that day needs a longer sentence.
• Strict mode turns off overrides entirely.
• Choose the hour your day resets and how long data is kept.
• Export your data as JSON or CSV, import JSON, or delete everything with one button.

YOUR DATA STAYS ON YOUR DEVICE
Overstay stores everything in your browser's local extension storage. It makes no network requests, includes no analytics, loads no remote code, and needs no account. It does not store browsing history or URLs — only the number of seconds spent per domain in each hour of the day.

PERMISSIONS, IN PLAIN WORDS
Chrome will say Overstay can "read and change all your data on all websites". Overstay needs this only to redirect a site you have limited to its block page once your time is up. It never reads or changes page content.

OPEN SOURCE
Overstay is free and open source under the MIT License. Source code and issues: https://github.com/Arudchayan/overstay
```

### Category

**Workflow & Planning** (the store describes it as covering time trackers and tools to stay focused). Alternative: Well-being.

### Language

English

### Graphic assets

All in [`chrome/`](chrome/), generated from demo data with `npm run store-assets`.

| Field                         | File                                                                                           | Required                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Store icon (128x128)          | [`store-icon-128.png`](chrome/store-icon-128.png) (96x96 artwork, 16 px transparent padding)   | Yes                                                          |
| Screenshot 1 (1280x800)       | [`screenshot-1-overview.png`](chrome/screenshot-1-overview.png): today at a glance             | Yes (1–5)                                                    |
| Screenshot 2                  | [`screenshot-2-blocked.png`](chrome/screenshot-2-blocked.png): block page and typing challenge |                                                              |
| Screenshot 3                  | [`screenshot-3-limits.png`](chrome/screenshot-3-limits.png): daily limits                      |                                                              |
| Screenshot 4                  | [`screenshot-4-dark.png`](chrome/screenshot-4-dark.png): 30-day history, night theme           |                                                              |
| Screenshot 5                  | [`screenshot-5-popup.png`](chrome/screenshot-5-popup.png): toolbar popup                       |                                                              |
| Small promo tile (440x280)    | [`promo-small-440x280.png`](chrome/promo-small-440x280.png)                                    | Optional, but listings without one rank after those with one |
| Marquee promo tile (1400x560) | [`promo-marquee-1400x560.png`](chrome/promo-marquee-1400x560.png)                              | Optional (only for featuring)                                |

Screenshots and tiles are opaque 24-bit PNGs with square corners and no padding, as the store asks.

### Additional fields

- Official URL: leave empty (it needs a Search Console–verified domain).
- Homepage URL: `https://github.com/Arudchayan/overstay`
- Support URL: `https://github.com/Arudchayan/overstay/issues`
- Mature content: No.

## 3. Privacy practices tab

### Single purpose description

```text
Overstay tracks the active time you spend on websites, shows it to you, and lets you set daily time limits for those websites.
```

### Permission justifications

| Field                                 | Justification (paste as-is)                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                             | Saves the user's time statistics, limits and settings in local extension storage on the device; nothing is sent off the device.         |
| `tabs`                                | Reads the base domain of the active tab so active time is credited to the right website; URLs and page titles are never stored.         |
| `idle`                                | Detects when the user is away from the computer so idle time is not counted toward any website.                                         |
| `alarms`                              | Schedules periodic saves, expires unlock grace periods, and runs the daily reset at the hour the user chose.                            |
| `notifications`                       | Warns the user when a site reaches 80% of its daily limit and again with 5 minutes left.                                                |
| `declarativeNetRequestWithHostAccess` | Redirects a website the user has limited to the extension's own block page once its daily limit is reached.                             |
| Host permission (`<all_urls>`)        | Lets the block-page redirect apply to whichever websites the user chooses to limit; the extension never reads or modifies page content. |

### Remote code

Select **No, I am not using remote code.** Justification (if asked): `All JavaScript is bundled in the package; the extension makes no network requests.`

### Data usage

Leave every data-type box **unchecked**. Overstay collects none of them, because nothing leaves the device:

- Personally identifiable information
- Health information
- Financial and payment information
- Authentication information
- Personal communications
- Location
- Web history
- User activity
- Website content

Time-per-domain totals are computed and stored only on the user's device and are never transmitted to the developer or anyone else, so they are not "collected" in the store's sense. This matches `PRIVACY.md`.

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

```text
https://github.com/Arudchayan/overstay/blob/main/PRIVACY.md
```

## 4. Distribution tab

- Payments: Free.
- Visibility: Public (or Unlisted for a soft launch; Unlisted items install from a direct link only).
- Regions: All regions.

## 5. Your submission checklist

These steps need your Google account and payment, so only you can do them. Nothing here has been done for you.

**Register (once)**

1. [ ] Turn on 2-Step Verification for the Google account you will publish with. The store requires it to publish or update items. Pick this account carefully: the developer account's email cannot be changed later.
2. [ ] Go to <https://chrome.google.com/webstore/devconsole> and sign in with that account.
3. [ ] Accept the developer agreement and pay the one-time registration fee (US$5 at the time of writing; the dashboard shows the current amount). You pay this yourself.
4. [ ] In **Account**, set a publisher name (for example "Arudchayan") and add and **verify** a contact email. You can't publish until it is verified.
5. [ ] If the dashboard asks for a trader / non-trader declaration (EU), Overstay is a free, non-commercial hobby project, so non-trader is usually the right answer — but it is your legal call.

**Create the item**

6. [ ] Build the zip: `npm ci && npm run zip`, or download `overstay-0.1.0-chrome.zip` from the [v0.1.0 release](https://github.com/Arudchayan/overstay/releases/tag/v0.1.0).
7. [ ] In the dashboard, click **New item** and upload the zip.
8. [ ] **Store listing** tab: paste the description, pick the category and language, upload the store icon, the five screenshots and the small promo tile (marquee optional), and fill in the homepage and support URLs. All from section 2 above.
9. [ ] **Privacy** tab: paste the single-purpose statement and each permission justification, select "No" for remote code, leave the data types unchecked, tick the three certifications, and paste the privacy policy URL. All from section 3 above.
10. [ ] **Distribution** tab: Free, Public, all regions.
11. [ ] Click **Submit for review**. Optionally untick "publish automatically after approval" if you want to choose the launch moment.

**After submitting**

12. [ ] Expect a longer, in-depth review because of `<all_urls>`. You'll get an email when it is approved or rejected; a rejection names the policy and can be answered by uploading a fixed version.
13. [ ] Once live, copy the store URL into `README.md` under **Installation → From a store**.
14. [ ] Note the 32-character item ID and your publisher ID (**Settings**) if you want automated uploads (section 6).

For every later release: bump `version` in `package.json` (the store rejects an upload whose version is not higher), tag it, then upload the new zip in **Package** and submit again.

## 6. Optional: automated store uploads from CI

Not wired up. The first upload and the listing and privacy tabs must be done by hand in the dashboard; after that, releases can be uploaded with the Chrome Web Store API (`https://chromewebstore.googleapis.com/v2/publishers/PUBLISHER_ID/items/ITEM_ID:upload` then `:publish`, OAuth scope `https://www.googleapis.com/auth/chromewebstore`).

One-time setup, done by you:

1. Create a Google Cloud project, enable the **Chrome Web Store API**, configure an external OAuth consent screen with yourself as a test user, and create an OAuth client.
2. Get a refresh token for the `chromewebstore` scope (for example with the OAuth 2.0 Playground).
3. Add repository secrets: `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.

Then add a step to the end of `.github/workflows/release.yml`. This version calls the v2 API directly with `curl`, so it needs no extra dependency:

```yaml
- name: Upload to the Chrome Web Store
  env:
    CLIENT_ID: ${{ secrets.CHROME_CLIENT_ID }}
    CLIENT_SECRET: ${{ secrets.CHROME_CLIENT_SECRET }}
    REFRESH_TOKEN: ${{ secrets.CHROME_REFRESH_TOKEN }}
    PUBLISHER_ID: ${{ secrets.CHROME_PUBLISHER_ID }}
    ITEM_ID: ${{ secrets.CHROME_EXTENSION_ID }}
  run: |
    set -euo pipefail
    if [ -z "$REFRESH_TOKEN" ]; then echo "No store secrets; skipping."; exit 0; fi
    TOKEN=$(curl -fsS https://oauth2.googleapis.com/token \
      --data-urlencode "client_id=$CLIENT_ID" \
      --data-urlencode "client_secret=$CLIENT_SECRET" \
      --data-urlencode "refresh_token=$REFRESH_TOKEN" \
      -d grant_type=refresh_token | jq -r .access_token)
    API=https://chromewebstore.googleapis.com
    ITEM="publishers/$PUBLISHER_ID/items/$ITEM_ID"
    curl -fsS -X POST -H "Authorization: Bearer $TOKEN" \
      -T dist/overstay-*-chrome.zip "$API/upload/v2/$ITEM:upload"
    # Uploads are processed asynchronously; wait until it is no longer IN_PROGRESS.
    for i in $(seq 1 30); do
      STATE=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$API/v2/$ITEM:fetchStatus" | jq -r '.lastAsyncUploadState // .uploadState // empty')
      [ "$STATE" != "IN_PROGRESS" ] && break
      sleep 10
    done
    curl -fsS -X POST -H "Authorization: Bearer $TOKEN" "$API/v2/$ITEM:publish"
```

Notes:

- The step skips itself when the secrets are not set, so forks and the current setup keep working.
- Check the response field names against the API reference before relying on the status loop.
- An alternative is WXT's built-in `wxt submit`, which wraps the same API and also handles Firefox Add-ons. Confirm which Chrome API version it calls before adopting it.
- Publishing still goes through review; the step only submits.

## References

- Register: https://developer.chrome.com/docs/webstore/register
- Account setup: https://developer.chrome.com/docs/webstore/set-up-account
- Prepare (manifest limits): https://developer.chrome.com/docs/webstore/prepare
- Listing fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Images: https://developer.chrome.com/docs/webstore/images
- Privacy tab: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Categories: https://developer.chrome.com/docs/webstore/best_practices
- Publish: https://developer.chrome.com/docs/webstore/publish
- API: https://developer.chrome.com/docs/webstore/using-api
- Program policies: https://developer.chrome.com/docs/webstore/program-policies
