# Production acceptance — 22 September 2026

Production: https://the-royal-flush.netlify.app

Netlify project: `the-royal-flush` (existing project reused).

## Verified

- Production HTTPS homepage, branding, OpenStreetMap tiles and attribution.
- Geographic search selected the real Costco address at 2901 Los Feliz Boulevard, Los Angeles; map centered and search marker appeared.
- Empty form displayed field errors. Independent malformed API request returned HTTP 400.
- Submitted a clearly marked temporary restroom through the live UI with a four-star rating, both test codes and notes. Form closed, marker appeared immediately, and details opened with the correct values.
- Adjusting the pin changed saved latitude; mouse drag also moved the preview pin at a 390 × 844 viewport.
- Both code copy buttons wrote the expected text to the browser clipboard.
- Get Directions opened Google Maps with the saved coordinates.
- Restroom survived a page reload and a production redeployment.
- A separate HTTP client retrieved the same server UUID and values.
- An isolated sandboxed browser frame (no same-origin/storage access) fetched and displayed the same public record. This proves the display did not depend on local storage. The browser service does not expose an incognito/new-profile control; this was an isolated-frame check, not a separate browser profile.
- At a real 390 × 844 iframe viewport, header measured 72px and page scroll width equaled 390px. Map, search, add button, scrollable detail sheet and form fit the viewport. Mobile testing used Chrome at phone dimensions, not physical iOS/Android hardware.
- Production health reported connected site-scoped `royal-flush-restrooms`. The deploy permalink used the separate development store as intended.
- The exact temporary record was deleted and public GET returned an empty collection. Temporary QA pages and cleanup function were removed from final source.
- 26 automated tests passed; TypeScript and Vite production build passed. Tests cover server validation, generated IDs/timestamps, storage failures, geocoding errors/cache, required form fields, keyboard rating, duplicate warnings, blank-code display, copying and coordinate directions.

The isolated sandbox frame lacked a normal tile referrer, so OpenStreetMap rejected tiles there; the normal production page and normal mobile viewport loaded tiles correctly. The sandbox fixture was temporary and is absent from production.

## Version 1 limits

One contributor rating per record; no editing, deletion, reports or moderation UI. Anonymous public contributions can become outdated or inaccurate. Free Photon search and OpenStreetMap tile services have usage limits and no uptime guarantee; search matching can require a shorter address or place name. At larger scale, add stronger abuse controls, viewport-based data queries and a dedicated geocoding/tile provider.

Future priorities: updates/reporting, multiple ratings with averages, accessibility and baby-changing information, verified-code dates, and photos.
