# AI Investment Research — Public

This repository contains the human-facing website and API reading guide. The Collector, API and Admin remain in their own repositories.

- Preserve the existing editorial design, imagery, Japanese phrase boundaries, responsive behavior and reduced-motion support.
- Visible content must distinguish repository configuration, implementation and observed production availability. Never infer a successful run, live coverage, uptime, real-time prices or available inventory from source code.
- Editorial dataset scope lives in `lib/public-catalog.ts`; revise its review date and `docs/content-audit.md` when refreshing the source audit.
- API responses are the authority for current public data and source-specific reuse conditions. Do not add private D1/R2 bindings, Collector controls, acquisition credentials or an arbitrary HTTP proxy here.
- No browser-side cross-origin fetching should be assumed to work until the API's CORS behavior has been verified. The current website links public read endpoints.
- Preserve anonymous branding. Do not add the operator's personal name or email to public copy. Contact uses the existing Tally URL.
- Keep original currencies, units, source dates, observation times, quality flags and reuse conditions intact when adding data views. Unknown/missing is not zero; advertised price is not transaction price.
- Changes to this website do not authorize API/Admin deployment, database migration, domain/Access changes or newly enabled collectors.
- Run TypeScript checking and the build for source changes. Do not commit dependencies, build output, runtime state, credentials or TypeScript build caches.

The existing `.openai/hosting.json` identifies the same Sites project. Preserve its identity and audience when updating the Sites publication. A separate deployment to `ai-investment-research.net` requires its own explicit request and configuration review.
