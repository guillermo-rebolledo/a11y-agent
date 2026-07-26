# Use Google Cloud KMS for envelope encryption

Status: Superseded by ADR-0004

Captured sessions require rotation, revocation, auditability, and cryptographic
deletion without long-lived cloud credentials. The service uses Vercel OIDC to
reach Google Cloud KMS, with a tenant-and-environment KEK wrapping a Project DEK;
preview deployments and browser Sandboxes receive no direct KMS access.

ADR-0004 removes browser-session custody from the service. Authentication
material now remains in customer-controlled local or GitHub Actions
environments, so browser-session envelope encryption is no longer part of the
MVP. This record remains as the rationale for the superseded hosted-session
design.
