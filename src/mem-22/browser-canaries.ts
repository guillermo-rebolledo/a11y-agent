export type BrowserCanaries = {
  email: string;
  phone: string;
  token: string;
  cookie: string;
  secret: string;
  loginEmail: string;
};

export function createBrowserCanaries(input: {
  loginEmail: string;
  loginSecret: string;
  journeyIndex: string;
}): BrowserCanaries {
  return {
    email: `journey-${input.journeyIndex}@example.invalid`,
    phone: "+1 (415) 555-0199",
    token: "ghp_012345678901234567890123456789012345",
    cookie: "synthetic-session=browser-job-only",
    secret: input.loginSecret,
    loginEmail: input.loginEmail,
  };
}

export function assertBrowserCanariesAbsent(
  serializedArtifact: string,
  canaries: BrowserCanaries,
): void {
  if (
    Object.values(canaries).some((canary) =>
      serializedArtifact.includes(canary),
    )
  ) {
    throw new Error("Sensitive browser material reached the Evidence Bundle");
  }
}
