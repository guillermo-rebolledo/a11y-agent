export const FIXTURE_SESSION_COOKIE = "a11y-fixture-session";
export const FIXTURE_INSTALLATION_COOKIE = "a11y-fixture-installation";

export function fixtureAuthEnabled() {
  const fixtureEnvironments = new Set(["development", "test", "preview"]);
  return (
    process.env.GITHUB_FIXTURE_AUTH_ENABLED === "true" &&
    fixtureEnvironments.has(process.env.APP_ENV ?? "")
  );
}
