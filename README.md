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
