export const FIXTURE_SESSION_COOKIE = "a11y-fixture-session";
export const FIXTURE_INSTALLATION_COOKIE = "a11y-fixture-installation";

export function fixtureAuthEnabled() {
  return (
    process.env.GITHUB_FIXTURE_AUTH_ENABLED === "true" &&
    process.env.APP_ENV !== "production"
  );
}
