# Use Google Cloud KMS for envelope encryption

Captured sessions require rotation, revocation, auditability, and cryptographic
deletion without long-lived cloud credentials. The service uses Vercel OIDC to
reach Google Cloud KMS, with a tenant-and-environment KEK wrapping a Project DEK;
preview deployments and browser Sandboxes receive no direct KMS access.

