import { testPublicHttp } from "./test-public-http.mjs";
import { withBuiltPublicWorker } from "./test-public-actions.mjs";

// Dispatch to pinned workerd directly. No Wrangler proxy or external server.
await withBuiltPublicWorker(testPublicHttp);
