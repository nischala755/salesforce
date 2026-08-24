import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_SECONDS, verifySessionToken } from "@/lib/auth/session";
import { requireDpoRole } from "@/lib/auth/authorization";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-definitely-at-least-32-characters";
});

describe("signed sessions", () => {
  const issued = new Date("2026-08-23T00:00:00.000Z");

  it("round-trips required identity claims", async () => {
    const token = await createSessionToken({ sub: "user-1", email: "admin@example.in", name: "Admin", role: "admin" }, issued);
    await expect(verifySessionToken(token, new Date(issued.getTime() + 1_000))).resolves.toMatchObject({ sub: "user-1", email: "admin@example.in", role: "admin" });
  });

  it("rejects an expired 8-hour session", async () => {
    const token = await createSessionToken({ sub: "user-1", email: "admin@example.in", name: "Admin", role: "admin" }, issued);
    await expect(verifySessionToken(token, new Date(issued.getTime() + (SESSION_SECONDS + 1) * 1_000))).rejects.toThrow();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({ sub: "user-1", email: "admin@example.in", name: "Admin", role: "admin" }, issued);
    await expect(verifySessionToken(`${token.slice(0, -1)}x`, issued)).rejects.toThrow();
  });
});

describe("DPO separation of duties", () => {
  it("allows the DPO persona and rejects an operational administrator", () => {
    expect(() => requireDpoRole({ role: "dpo" })).not.toThrow();
    expect(() => requireDpoRole({ role: "admin" })).toThrow("FORBIDDEN");
  });
});
