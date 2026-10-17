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

## GitHub Actions

The repository has three GitHub Actions workflows:

- **Site checks** (`.github/workflows/site-checks.yml`) runs for pull requests
  targeting `main`, pushes to `main`, and manual runs from the Actions tab. It
  installs the build tools and runs `npm run validate`.
- **Deploy optimized site** (`.github/workflows/deploy-pages.yml`) runs on
  pushes to `main` and can also be started manually. It installs the build
  tools, runs `npm run validate`, builds the optimized site in `dist/`, and
  deploys it to GitHub Pages. Set **Settings → Pages → Source** to **GitHub
  Actions** once to enable Pages deployments.
- **Update Airbnb availability**
  (`.github/workflows/update-availability.yml`) runs hourly at 17 minutes past
  the hour and can also be started manually. It fetches both Airbnb calendars
  and updates `availability.json` and `availability.js` if their dates have
  changed. When there is a change, it commits and pushes those files directly
  to `main`, then starts the deploy workflow. When there is no change, it
  skips the commit and deployment.

Because the availability workflow pushes directly to `main`, repository rules
must allow that workflow's push; requiring a pull request or a status check
before updating `main` will block it. Site checks still run on pushes to
`main` and pull requests, and the deploy workflow validates the site before
publishing.

## Automated site checks

Run the complete checks locally with:

```bash
npm run validate
```

This validates page landmarks and metadata, local links and assets, CSS and
JavaScript syntax, JSON-LD, availability data, Instagram analytics wiring, and
the final optimized build. After `npm install`, the local pre-commit hook runs
these checks before each commit. The **Site checks** workflow runs the same
validation for pushes and pull requests.

You can configure branch rules under **Settings → Rules → Rulesets**. Keep in
mind that requiring a pull request or a status check before changes reach
`main` also blocks the availability workflow's direct push unless the rule
explicitly allows that workflow to bypass it. GitHub Actions failure
notifications use your GitHub account's email preferences; enable email
delivery for Actions under **Settings → Notifications** in GitHub.

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
