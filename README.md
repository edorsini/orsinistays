# Orsini Stays

Static website for [orsinistays.com](https://www.orsinistays.com).

## Production optimization

Install the local build tools once, then create an optimized deployable site in
`dist/`:

```bash
npm install
npm run optimize
```

The source files remain unchanged. The build minifies HTML (including inline
CSS and JavaScript), processes standalone CSS with Lightning CSS, and minifies
standalone JavaScript with Terser—the maintained successor to UglifyJS. Deploy
the contents of `dist/` when you want the optimized version live.

GitHub Actions builds and deploys `dist/` automatically after every push to
`main`. In the repository, set **Settings → Pages → Source** to **GitHub
Actions** once. The availability updater triggers the same deployment only
when its calendar data has changed.

## Automated site checks

Run the complete checks locally with:

```bash
npm run validate
```

This validates page landmarks and metadata, local links and assets, CSS and
JavaScript syntax, JSON-LD, availability data, Instagram analytics wiring, and
the final optimized build. After `npm install`, the local pre-commit hook runs
these checks before each commit. The **Site checks** GitHub Action runs the
same validation for pushes and pull requests; deployment runs only after it
passes.

To stop failed changes from reaching `main`, configure a branch rule in GitHub:
**Settings → Rules → Rulesets → New branch ruleset**. Target the `main` branch,
require a pull request, and require the **Site checks / test** status check.
GitHub’s normal Actions failure notifications use your GitHub account’s email
preferences; enable email delivery for Actions under **Settings →
Notifications** in GitHub.

## Travel guide

The SEO-friendly travel guide lives in `guides/`. To publish a new article,
copy an existing article folder, then update its title and metadata, JSON-LD,
`data-guide` slug, image alt text, related links, the card on `guides/index.html`,
and `sitemap.xml`. Run `npm run validate` before opening the pull request.

## Airbnb availability

The property calendars read blocked date ranges from `availability.json`. The
matching `availability.js` snapshot supports opening `index.html` directly for
local previews. A scheduled GitHub Actions workflow refreshes both files from
Airbnb every hour. The public files contain dates only—never calendar tokens or
reservation details.

Configure these repository Actions secrets before running the workflow:

- `AIRBNB_DREAMCATCHER_ICAL_URL`
- `AIRBNB_HAPPY_PLACE_ICAL_URL`

In GitHub, open **Settings → Secrets and variables → Actions**, add both
repository secrets, and then manually run **Update Airbnb availability** once
from the **Actions** tab. After that, it runs automatically each hour.
