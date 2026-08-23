import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("security invariants", () => {
  it("guards every API route except login with requireSession", () => {
    const routes = filesUnder(join(process.cwd(), "app", "api")).filter((path) => path.endsWith("route.ts"));
    for (const route of routes) {
      const source = readFileSync(route, "utf8");
      if (route.endsWith(join("auth", "login", "route.ts"))) expect(source).not.toContain("requireSession(");
      else expect(source, route).toContain("requireSession(");
    }
  });

  it("keeps the Mistral key out of client components", () => {
    const clientFiles = [...filesUnder(join(process.cwd(), "app")), ...filesUnder(join(process.cwd(), "components"))].filter((path) => /\.(ts|tsx)$/.test(path));
    for (const path of clientFiles) expect(readFileSync(path, "utf8"), path).not.toContain("MISTRAL_API_KEY");
  });

  it("configures hardened session-cookie attributes", () => {
    const source = readFileSync(join(process.cwd(), "lib", "auth", "session.ts"), "utf8");
    expect(source).toContain("httpOnly: true");
    expect(source).toContain('sameSite: "lax"');
    expect(source).toContain('process.env.NODE_ENV === "production"');
  });

  it("contains no core assessment mutation calls", () => {
    const source = [...filesUnder(join(process.cwd(), "app")), ...filesUnder(join(process.cwd(), "lib"))].filter((path) => /\.(ts|tsx)$/.test(path)).map((path) => readFileSync(path, "utf8")).join("\n");
    expect(source).not.toMatch(/compliance(?:Assessment|Result)\.(?:update|upsert|delete)/);
  });
});
