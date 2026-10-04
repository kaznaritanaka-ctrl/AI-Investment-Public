import type { Metadata } from "next";
import { API_ORIGIN, API_REPOSITORY, PUBLIC_REPOSITORY, SCOPE_REVIEW_DATE } from "@/lib/public-catalog";

export const metadata: Metadata = {
  title: "API仕様 — AI Investment Research",
  description: "AI Investment Research public API v0.3.0 technical specification.",
};

const routeGroups = [
  {
    name: "Core",
    routes: [
      ["/v1/datasets", "Dataset definitions"],
      ["/v1/sources", "Authorized source notices and scope"],
      ["/v1/latest", "Latest accepted revision per exact series; maximum 100 series"],
      ["/v1/observations", "Append-only observation and correction history"],
      ["/v1/changes", "Same-condition value changes"],
      ["/v1/fx", "ECB reference FX and derived USD/JPY"],
    ],
  },
  {
    name: "Models",
    routes: [
      ["/v1/models/coverage", "Model catalog snapshot coverage"],
      ["/v1/models/events", "Catalog and price history events"],
    ],
  },
  {
    name: "GPU",
    routes: [
      ["/v1/gpu/catalog", "GPU identification dictionary"],
      ["/v1/gpu/coverage", "Search coverage and completeness"],
      ["/v1/gpu/metrics", "Comparable cohort statistics"],
      ["/v1/gpu/comparisons", "Persisted GPU comparisons"],
    ],
  },
  {
    name: "Metadata",
    routes: [
      ["/v1/methodology/{id}", "Methodology or source-license notice"],
      ["/health", "Public data / collector health metadata"],
      ["/openapi.json", "OpenAPI 3.1 contract"],
      ["/llms.txt", "Machine-readable usage notes"],
    ],
  },
] as const;

export default function ApiGuide() {
  return <>
    <a className="skip-link" href="#guide-main">本文へ移動</a>
    <header className="site-header guide-header">
      <a className="brand" href="/" aria-label="AI Investment Research トップへ"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span>AI INVESTMENT<br />RESEARCH</span></a>
      <nav aria-label="APIナビゲーション">
        <a href="/">Home</a>
        <a href={`${API_ORIGIN}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI</a>
      </nav>
    </header>

    <main id="guide-main" className="guide-main">
      <section className="guide-hero dark-section">
        <span className="eyebrow">API SPECIFICATION</span>
        <h1>HTTP API<br /><em>v0.3.0</em></h1>
        <p>Public read-only API. OpenAPI 3.1.0.</p>
        <div className="guide-meta"><span>Reviewed {SCOPE_REVIEW_DATE}</span><span>GET / HEAD · JSON · no-store</span></div>
      </section>

      <div className="guide-body light-section">
        <nav className="guide-index" aria-label="API仕様の目次">
          <span>CONTENTS</span>
          <a href="#http">01 HTTP</a>
          <a href="#routes">02 Endpoints</a>
          <a href="#query">03 Query</a>
          <a href="#response">04 Response</a>
          <a href="#errors">05 Errors</a>
        </nav>

        <div className="guide-sections">
          <section id="http" className="guide-section">
            <span className="section-kicker">01 / HTTP</span>
            <h2>Connection</h2>
            <div className="guide-base"><span>BASE URL</span><code>{API_ORIGIN}</code></div>
            <dl className="guide-terms">
              <div><dt>Protocol</dt><dd>HTTPS</dd></div>
              <div><dt>Methods</dt><dd>GET, HEAD</dd></div>
              <div><dt>Response</dt><dd>application/json</dd></div>
              <div><dt>Cache</dt><dd>Cache-Control: no-store</dd></div>
              <div><dt>API version</dt><dd>0.3.0</dd></div>
              <div><dt>OpenAPI</dt><dd>3.1.0</dd></div>
            </dl>
            <dl className="guide-route-list">
              <div><dt><a href={`${API_ORIGIN}/openapi.json`} target="_blank" rel="noreferrer"><code>/openapi.json</code></a></dt><dd>Canonical API contract</dd></div>
              <div><dt><a href={`${API_ORIGIN}/llms.txt`} target="_blank" rel="noreferrer"><code>/llms.txt</code></a></dt><dd>Machine-readable usage notes</dd></div>
              <div><dt><a href={`${API_ORIGIN}/health`} target="_blank" rel="noreferrer"><code>/health</code></a></dt><dd>Public health metadata</dd></div>
            </dl>
          </section>

          <section id="routes" className="guide-section">
            <span className="section-kicker">02 / ENDPOINTS</span>
            <h2>Routes</h2>
            {routeGroups.map((group) => <div key={group.name}>
              <span className="small-index">{group.name.toUpperCase()}</span>
              <dl className="guide-route-list">
                {group.routes.map(([path, description]) => <div key={path}>
                  <dt>{path.includes("{id}") ? <code>{path}</code> : <a href={`${API_ORIGIN}${path}`} target="_blank" rel="noreferrer"><code>{path}</code></a>}</dt>
                  <dd>{description}</dd>
                </div>)}
              </dl>
            </div>)}
            <div className="guide-note"><p>Route existence does not imply that a dataset currently contains public observations.</p></div>
          </section>

          <section id="query" className="guide-section">
            <span className="section-kicker">03 / QUERY</span>
            <h2>Parameters</h2>
            <dl className="guide-terms">
              <div><dt>limit</dt><dd>1–100 where supported; default 50 on paginated endpoints.</dd></div>
              <div><dt>cursor</dt><dd>Opaque keyset cursor. Keep filters unchanged when continuing a query.</dd></div>
              <div><dt>from / to</dt><dd>UTC interval. History queries support a maximum interval of 366 days.</dd></div>
              <div><dt>as_of</dt><dd>Knowledge cutoff timestamp. Current source rights still apply.</dd></div>
              <div><dt>dataset</dt><dd>Dataset filter. <code>ai_model_catalog</code> is opt-in.</dd></div>
              <div><dt>snapshot / model_snapshot</dt><dd>Snapshot-scoped retrieval for complete model/GPU captures where supported.</dd></div>
            </dl>
          </section>

          <section id="response" className="guide-section">
            <span className="section-kicker">04 / RESPONSE</span>
            <h2>Conventions</h2>
            <dl className="guide-terms">
              <div><dt>schema_version</dt><dd>Public response schema version.</dd></div>
              <div><dt>decimal</dt><dd>Decimal values are serialized as strings.</dd></div>
              <div><dt>null</dt><dd>Unknown or unavailable. Never equivalent to zero.</dd></div>
              <div><dt>next_cursor</dt><dd>Present when another page is available.</dd></div>
              <div><dt>observed_at</dt><dd>Source observation timestamp.</dd></div>
              <div><dt>recorded_at</dt><dd>Persistence / correction timestamp.</dd></div>
            </dl>
          </section>

          <section id="errors" className="guide-section">
            <span className="section-kicker">05 / ERRORS</span>
            <h2>HTTP status</h2>
            <dl className="guide-route-list">
              <div><dt><code>400</code></dt><dd>Invalid filter, interval or cursor</dd></div>
              <div><dt><code>404</code></dt><dd>No matching data or resource</dd></div>
              <div><dt><code>405</code></dt><dd>Read-only endpoint; Allow: GET, HEAD</dd></div>
              <div><dt><code>429</code></dt><dd>Rate limit</dd></div>
              <div><dt><code>503</code></dt><dd>Public data store unavailable</dd></div>
            </dl>
            <div className="guide-link-row">
              <a className="text-link" href={`${API_ORIGIN}/openapi.json`} target="_blank" rel="noreferrer">OpenAPI JSON</a>
              <a className="text-link" href={API_REPOSITORY} target="_blank" rel="noreferrer">API source</a>
            </div>
          </section>
        </div>
      </div>
    </main>

    <footer className="site-footer guide-footer">
      <a href="/">AI Investment Research</a>
      <div><a href={PUBLIC_REPOSITORY} target="_blank" rel="noreferrer">Public source</a><a href={API_REPOSITORY} target="_blank" rel="noreferrer">API source</a></div>
      <span>© 2026 AI Investment Research</span>
    </footer>
  </>;
}
