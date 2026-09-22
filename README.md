# The Royal Flush

**Know before you go.**

A public, mobile-first community restroom map. Visitors can search places, find restroom ratings and access codes, add locations without accounts, adjust an address pin, copy codes, and get directions.

## Stack

- React 19, TypeScript, Vite, straightforward responsive CSS
- Leaflet / React Leaflet, MarkerCluster, OpenStreetMap raster tiles
- Modern Netlify Functions using `Request` / `Response`
- Site-scoped Netlify Blobs, strong consistency, one object per restroom
- Photon geocoder, proxied and cached through a function

## Install and run

Use Node.js 22 or newer.

```sh
npm install
npm run dev
```

Vite alone serves the frontend. To exercise the API and Blobs, use:

```sh
npm run dev:netlify
# Or isolated local operation without account access:
npx netlify dev --offline
```

Open the URL printed by Netlify Dev, normally `http://localhost:8888`. It provides isolated local storage under `.netlify`; it does not write to production. Geocoding still requires an internet connection to Photon. Vite is bound to loopback by default; change `server.host` for intentional LAN testing.

```sh
npm test
npm run build
node scripts/local-acceptance.mjs
```

The acceptance script starts and stops its own local Netlify Dev server, verifies real local storage and independent HTTP reads, and reports geocoder availability. Its entries are local test data only. It is not a substitute for production browser testing.

## Storage

`netlify/functions/_shared/storage.ts` chooses the store from trusted Netlify request context. The currently published production deploy uses `royal-flush-restrooms`; non-production/draft/local requests use `royal-flush-restrooms-development`. Netlify Dev separately emulates storage on disk. Production records are site-scoped, so future deployments keep the same data.

Each record has a server-generated UUID at `restrooms/{uuid}`, a normalized input body, and server-generated ISO timestamps. GET lists all pages and reads objects in bounded batches with strong consistency. Simultaneous submissions cannot overwrite a shared collection because they have separate keys. Client IDs, timestamps, and arbitrary extra fields are ignored. No restroom records are stored in LocalStorage or cookies. Geolocation only updates client memory and is never posted.

All visitors can read, submit and edit. There is no public delete API. Operational cleanup uses authenticated Netlify Blobs tools or the dashboard and the exact known test UUID; never delete a collection to clean one test record. Back up and inspect any existing production store before introducing a schema migration.

## API

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/restrooms` | All restroom records, newest first, no HTTP response cache |
| POST | `/api/restrooms` | Validates JSON, creates one record, returns `{restroom}` with HTTP 201 |
| PUT | `/api/restrooms/:id` | Updates a listing with `expectedUpdatedAt`; returns 200 or 409 on a conflicting edit |
| GET | `/api/geocode?q=...` | Up to five Photon results with display names and numeric coordinates |
| GET | `/api/health` | Verifies access to the current Blobs store and reports its name |

POST and PUT require `locationName` (2–120 characters), `address` (5–250), numeric valid `latitude`/`longitude`, and integer `rating` (1–5). `mensCode` and `womensCode` are optional text up to 50 characters; blanks become `null`. Notes are optional text up to 1,000 characters. All text is trimmed. HTML tags and invalid control characters are rejected, and React escapes display content. The server limits request bodies to 16 KB. Errors use human-readable JSON and appropriate HTTP status codes.

## Geocoding decision and provider policies

The public Nominatim endpoint is not used. Its [current usage policy](https://operations.osmfoundation.org/policies/nominatim/) prohibits autocomplete and requires a global one-request-per-second application limit, among other restrictions.

[Photon's official documentation](https://github.com/komoot/photon) supports search-as-you-type and permits reasonable-volume public API usage. It offers no availability guarantee and may throttle heavy use. This release uses a three-character minimum, an 800 ms debounce, cancellation of stale requests, in-memory client reuse, a 24-hour server-side result cache, five results, a ten-second upstream timeout, and a Netlify rate-limit declaration of 20 requests per minute per IP/domain. Provider failures are shown cleanly. No paid geocoder is introduced.

Optional **server-only** `PHOTON_BASE_URL` switches to another Photon-compatible service without changing the frontend. Store it in Netlify environment variables, not in browser code. Reassess provider capacity before meaningful traffic growth. Search accuracy depends on available OpenStreetMap address data; users confirm the result and may move the pin.

Tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, visible OpenStreetMap attribution, normal browser caching and a compatible Referrer-Policy. There is no prefetching, offline map download, or bulk tile retrieval. See the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). If switching tile hosts, update the CSP image allowlist and attribution as required.

## Deployment

The intended existing Netlify project is `the-royal-flush`. **Reuse it; do not create a duplicate.** Authenticate using the normal Netlify CLI flow, inspect accessible sites, and link its verified ID:

```sh
npx netlify status
npx netlify sites:list
npx netlify link --id VERIFIED_EXISTING_SITE_ID
npm test
npm run build
npx netlify deploy --build
# After checking the draft, publish the approved production version:
npx netlify deploy --prod --build
```

`netlify.toml` supplies Vite build settings, function location, response security headers, and caching for fingerprinted assets. There is no catch-all SPA rewrite to swallow `/api/*`. The application uses a single root route and `?restroom=UUID` for deep links.

No custom secret is needed for Blobs in deployed Functions. Never put a Netlify token into a `VITE_*` variable or commit credentials. Production must have public visitor access without password or SSO protection. Verify `/api/health` reports `royal-flush-restrooms` after publication; draft deploys should report the development store.

The owner also authorized an alternative public host if Netlify access remains unavailable. A migration must retain a real server-side shared store and equivalent validation. Do not deploy the frontend by itself and claim completion.

## Required production acceptance

1. Open the public URL without signing in. Confirm branding, map tiles/attribution, search, and Add Restroom.
2. Search `2901 Los Feliz Boulevard, Los Angeles`. Select the intended result and verify centering and its marker.
3. Add a clearly identified temporary test at a real address. Adjust its pin, select stars, fill both codes and notes, and save. Check HTTP 201, immediate marker, detail card, and toast.
4. Reload, then use a separate browser context/private session. Verify the same UUID and information. This is still required even if local API tests passed.
5. Copy both codes, verify clipboard contents, test an omitted code, and open directions. Verify share/deep links.
6. At approximately 390×844, inspect the home screen, open detail sheet, scroll the form, and check no horizontal overflow. Test desktop as well. Verify focus, Escape, keyboard stars, and reduced motion.
7. Submit an empty form and confirm clear errors with no POST. Check backend malformed payload rejection.
8. Delete only the created test UUID using authenticated storage access and verify its absence from an independent GET. Leave no fake entries in production.

## Project structure

```text
src/
  App.tsx                      Map application and state
  components/                  Search, map, form, detail sheet, ratings
  lib/api.ts                   API client and clipboard
  lib/map.ts                   Icons, clustering helpers, duplicate detection
  lib/validation.ts            Shared client/server field validation
  styles.css                   Responsive layout and design
  types.ts                     Shared types
netlify/functions/
  restrooms.ts                 GET / POST / PUT shared records
  geocode.ts                   Cached Photon proxy
  health.ts                    Storage health
  _shared/storage.ts           Scope selection and JSON responses
tests/                         API, validation, and form tests
scripts/local-acceptance.mjs    Real local Netlify Dev API check
```

## Version 1 limits and sensible next steps

- One submitted rating per location, not an aggregate of community reviews.
- Public anonymous information and codes are unverified and may become stale.
- Anyone can edit the full listing without an account. Conflicting edits are rejected so contributors can review the latest version. No deleting, reporting, photo upload, accounts, or moderation interface.
- New submissions appear immediately to their author; other already-open tabs use Refresh Restrooms or reload. There is no aggressive polling.
- Fetch-all storage works for an initial community launch. Larger scale needs viewport queries and an indexed database instead of reading every object.
- Free public mapping/geocoding services have best-effort availability. Provider and hosting plan capacity should be reviewed with real traffic.

Version 2 priorities: report outdated information, code verification history, multiple community ratings and averages, accessibility and changing-table filters, then photos.


## Editing a listing

Open a restroom marker and select **Edit**. The form starts with the existing name, address, coordinates, both codes, rating and notes. Select **Save Changes** to update that same record. Clearing an optional code removes it. The address does not need to be searched again unless it changes; the pin remains adjustable.

`PUT /api/restrooms/:id` accepts the same validated fields as POST plus `expectedUpdatedAt` from the original record. UUID and creation time remain unchanged; the server generates a new update time. A strong-consistency read plus a conditional Blob write (`onlyIfMatch`) rejects overlapping updates with HTTP 409 and the latest record. The UI preserves the draft and offers **View latest listing**; choosing it closes the draft so the contributor can edit the current version. Malformed requests return 400 and missing records return 404. Editing is public and anonymous, like adding a location.
