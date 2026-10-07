import { defineConfig } from "vitest/config";

/**
 * Bare for `npm run testdata` (scripts/lag-testdata.ts): kjører skriptet
 * med Vitest, så datalaget kan kobles til en vanlig SQLite-fil. Ikke en del
 * av `npm test`.
 */
export default defineConfig({
  test: {
    include: ["scripts/lag-testdata.ts"],
    environment: "node",
  },
});
