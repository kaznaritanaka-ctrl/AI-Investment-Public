# Public content audit — 2026-10-04

## Source snapshots

- API: `kaznaritanaka-ctrl/AI-Investment-APIs`, main `dd43e543ced4703819b68a9e061c20a85f997376`.
- Admin: `kaznaritanaka-ctrl/AI-Investment-Admin`, main `5ed8eb66312d3f1e88714d447ea4a58c7b89b375`.
- This is a repository audit, not a production run or Cloudflare resource verification. The user's reported P0 completion is not contradicted by older deployment notes.

## Human-facing claims

| Area | Evidence | Website treatment |
| --- | --- | --- |
| Models.dev prices/catalog | `config/sources/models_dev.json`, `docs/source-register.md`, `docs/models-enablement.md` | Five configured provider scopes: OpenAI, Anthropic, Google, xAI, Mistral. Secondary catalogue, not first-party verified prices. No fixed production model count. |
| ECB | `config/sources/ecb.json`, `src/fx.ts`, `docs/methodology.md` | EUR/USD and EUR/JPY original reference series; USD/JPY calculated cross. Not executable/live FX. |
| GPU | Source configs, GPU adapters, `docs/roadmap.md` | Rental/secondary pipelines prepared; real sources disabled. No claim of live GPU observations, inventory, sales or utilization. |
| Physical inputs | `docs/roadmap.md`, candidate source configs | Electricity, memory and equipment are research/planning. No live power/DDR/HBM dataset claim. |
| History | `docs/data-dictionary.md`, `src/publication.ts`, `openapi.json` | `observed_at`, `source_date`, `recorded_at`, appended corrections and current-rights enforcement. |
| API | `openapi.json`, `src/api.ts`, `src/models-api.ts`, `src/gpu-api.ts` | GET/HEAD discovery, observations, FX, model coverage and methods. Latest max 100; catalogue requires explicit dataset selection. |
| Admin | `src/Dashboard.tsx`, `src/worker.ts`, `src/network.ts` | Separate read-only personal console. Only Overview is implemented in the audited main; production may differ. Do not link it as a public dashboard. |
| Commercial use | Source configs, `docs/rights-policy.md` | No universal data license or pricing plan. Source-specific conditions apply, including restrictions on AI-service input. |

## Boundaries

- No acquisition credentials, private data or Admin status were copied into this frontend.
- No live fetch, new proxy, database or recurring updater was added. Current API CORS support was not established by the audited repository.
- Endpoint links describe the repository's contract; they do not verify availability of an expanded production deployment.
- Public source is stored in AI-Investment-Public. Sites preserves the existing project and audience; this work does not alter the production API/Collector/Admin or a custom domain.

When deployment and source scope change, refresh this audit and the shared catalogue. Verify the production API's datasets/coverage responses before changing a label to imply current public availability.
