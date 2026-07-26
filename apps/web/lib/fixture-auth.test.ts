import { afterEach, describe, expect, it } from "vitest";

import { fixtureAuthEnabled } from "./fixture-auth";

const originalEnabled = process.env.GITHUB_FIXTURE_AUTH_ENABLED;
const originalEnvironment = process.env.APP_ENV;

afterEach(() => {
  setEnvironment("GITHUB_FIXTURE_AUTH_ENABLED", originalEnabled);
  setEnvironment("APP_ENV", originalEnvironment);
});

describe("GitHub fixture authentication gate", () => {
  it("is disabled by default and in production", () => {
    delete process.env.GITHUB_FIXTURE_AUTH_ENABLED;
    delete process.env.APP_ENV;
    expect(fixtureAuthEnabled()).toBe(false);

    process.env.GITHUB_FIXTURE_AUTH_ENABLED = "true";
    process.env.APP_ENV = "production";
    expect(fixtureAuthEnabled()).toBe(false);
  });

  it("requires explicit enablement outside production", () => {
    process.env.GITHUB_FIXTURE_AUTH_ENABLED = "true";
    process.env.APP_ENV = "test";
    expect(fixtureAuthEnabled()).toBe(true);
  });
});

function setEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
