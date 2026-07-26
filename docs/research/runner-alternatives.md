# Disposable Chromium runner alternatives

Date: 2026-07-25

Status: Archived alternative analysis

ADR-0004 subsequently removed hosted browser execution from the MVP in favor of
a local Extension Recorder and customer-executed GitHub Action. The
recommendations below preserve the provider research that informed that pivot;
they are not the active Phase 0 plan, and their requirement matrix reflects the
superseded hosted-runner threat model.

## Decision summary

Run the next Phase 0 spike on **E2B**, configured with `secure: true`,
`lifecycle.onTimeout: "kill"`, no volume mounts, no sandbox environment secrets,
and an **external egress proxy controlled by us**. E2B is the closest managed
match because it says every Sandbox has its own Firecracker microVM, exposes
CPU, memory, disk, timeout, kill, lifecycle evidence, and at least 20 concurrent
Sandboxes, and its current create API exposes outbound allow/deny rules and an
egress-proxy field. None of that proves the network boundary: the published API
does not specify hostname matching, redirect handling, DNS-rebinding behavior,
IPv6 coverage, metadata endpoints, or whether traffic can bypass the proxy.
Those are blocking, explicitly **unverified** claims.

Keep a **self-managed Kubernetes + Kata Containers/Firecracker + Cilium +
external proxy** design as the fallback. It is the only option reviewed where
every mandatory boundary can be placed under our control, but it makes us
responsible for the hypervisor hosts, guest images, CNI, proxy, patching,
capacity, and evidence pipeline.

Do not advance AWS Fargate, Modal, or Fly Machines to authenticated testing yet:

- Fargate injects a task-metadata endpoint into every container, which conflicts
  with the literal “no metadata reachability” requirement.
- Modal's generally available Sandbox boundary is gVisor, not a fresh
  Firecracker microVM. Its VM runtime is Beta and its documentation does not
  identify the hypervisor or per-Sandbox VM allocation.
- Fly provides a Firecracker Machine and good lifecycle primitives, but no
  documented native deny-by-default hostname egress policy. Building a
  non-bypassable policy layer on Fly is currently unverified.

## Requirements and rating method

This report applies the blocking requirements in
[`docs/security/threat-model.md`](../security/threat-model.md) and
[`docs/phase-0-checklist.md`](../phase-0-checklist.md):

1. a digest-pinned Playwright OCI image;
2. one fresh VM-grade boundary per Journey, with no shared profile or filesystem;
3. no inherited credentials and no reachable metadata service;
4. deny-by-default egress with administrator-owned hostname allowlists;
5. denial of private, loopback, link-local, multicast, metadata, and unsafe IPv6
   destinations, including after DNS changes and redirects;
6. CPU, memory, disk, port, and time limits;
7. destruction after success, failure, crash, timeout, and cancellation;
8. five concurrent Journeys;
9. startup/runtime/resource/cost metrics plus image and dependency provenance.

Ratings mean:

- **Native** — the provider or named upstream component documents the feature.
- **Added component** — achievable only by adding and operating another trusted
  component. It still requires Phase 0 proof.
- **Unsupported** — a documented property conflicts with the requirement.
- **Unverified** — primary documentation does not establish the required
  semantics. Unverified is a failure for authenticated use.

No provider marketing statement is treated as Phase 0 evidence.

## Comparison matrix

| Candidate | VM-grade Journey isolation | Pinned Playwright image | Credential / metadata boundary | Network boundary | Limits, cleanup, concurrency | Evidence, metrics, cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **1. E2B** | **Native claim:** E2B says each Sandbox runs in its own Firecracker microVM. Must prove fresh allocation and cross-Sandbox isolation. | **Added component:** build a template whose Dockerfile uses `FROM …@sha256:…`; record the E2B template/build ID and independently verify the installed browser. Direct launch from an arbitrary OCI digest is **unverified**. | `secure: true` authenticates environment-service traffic. Run without env vars or volumes. Provider metadata endpoint existence/reachability is **unverified**. | API exposes `allowOut`, `denyOut`, and `egressProxy`, but their hostname/CIDR syntax, IPv6 behavior, enforcement layer, proxy bypass resistance, DNS revalidation, and redirect guarantees are **unverified**. Use our proxy and prove every attack. | **Native:** CPU/RAM/disk fields, timeout with kill, explicit kill, lifecycle events, and ≥20 concurrent Sandboxes. Destruction on every abnormal outcome and port exposure still need proof. | **Native:** resource stats and lifecycle execution data; public per-second pricing. Add signed image/SBOM/proof artifacts. | **Best managed Phase 0 candidate; not approved.** |
| **2. Kubernetes + Kata/Firecracker + Cilium + proxy** | **Native:** Kata creates a VM for a sandbox Pod and supports Firecracker; select it with `RuntimeClass`. One Journey per Pod. | **Native/added:** Kubernetes accepts OCI image references; admission policy must require an allowed digest and signature/SBOM. | **Added component:** disable service-account token automount, inject no cloud credentials, deny node/control-plane/metadata ranges in Cilium and the host network, and test the guest route table. | **Added component:** default-deny Cilium policy; only trusted cluster DNS and a separate proxy are reachable. Cilium FQDN policy learns IPs through its DNS proxy and respects TTL, while CIDR deny rules override allows. The proxy must independently validate every resolution and redirect, reject all forbidden IPv4/IPv6 ranges, and prevent direct-IP/SNI/Host confusion. | **Native:** Kubernetes CPU/memory/ephemeral-storage limits, Job deadlines, and TTL cleanup. Add a controller finalizer/reconciler and node-level microVM garbage collection. Five-way concurrency is capacity planning. | **Added component:** Metrics API/Hubble/Prometheus, Kubernetes events, proxy decisions, node/microVM audit records, registry signatures, and cloud/node cost allocation. | **Strongest controllable fallback; highest operational burden.** |
| **3. Modal VM Sandbox** | GA Sandboxes use gVisor (**unsupported** for the literal Firecracker requirement). A full VM runtime exists in Beta, but its hypervisor and one-VM-per-Sandbox semantics are **unverified**. | **Native/added:** imports registry images and Dockerfiles; use a digest reference and verify the realized image. | Sandboxes do not inherit access to other Modal resources by default. Metadata endpoint absence is **unverified**; do not include Modal OIDC identity tokens or Secrets. | **Native Beta:** exact-domain TLS/443 allowlist and CIDR allowlist; unlisted traffic is blocked and logged. Private-range precedence, DNS rebinding, redirect revalidation, IPv6, public-suffix validation, and proxy bypass are **unverified**. | **Native:** CPU and memory limits, a per-container disk quota, a maximum lifetime, terminate, and authenticated inbound connections. VM-specific disk enforcement and destruction evidence require proof. | Per-second resource billing and dashboard usage are documented. Exportable lifecycle/cost evidence and image provenance are **unverified**. | **Second managed spike only after Modal documents the VM and network semantics.** |
| **4. AWS ECS on Fargate + locked VPC + proxy** | **Native:** AWS says each task runs in an isolated hardware-virtualized environment and does not share a kernel, ENI, ephemeral storage, CPU, or memory with other tasks. It does not promise Firecracker by contract, so exact VMM identity is **unverified**. | **Native:** ECS/ECR can resolve container images to digests; pin and record the manifest digest and SBOM. | **Unsupported as written:** ECS injects a task-metadata endpoint into every container. Omitting a task role prevents task-role credentials, but does not remove task metadata. Execution-role credentials stay with the agent, not the container; verify empirically. | **Added component:** private subnet, no public IP/NAT, security group permitting only a proxy in a separate trust boundary, and NACL/Network Firewall denies. AWS Network Firewall hostname rules use HTTP Host or TLS SNI and explicitly do not perform DNS lookups; therefore they do not alone prove DNS-rebinding defense. The proxy must resolve/revalidate and inspect redirects. Localhost and link-local metadata remain blockers. | **Native:** required task CPU/memory and 20–200 GiB ephemeral storage. ECS stop plus orchestrator deadlines/reconciliation are added controls. Five tasks are routine quota/capacity, not yet measured. | CloudWatch/Container Insights exposes resource data including ephemeral storage; Cost Explorer and task tags can allocate cost. Add task-state, proxy, digest, and deletion evidence. | **Reject unless the metadata requirement is narrowed or AWS offers a documented way to disable all task metadata.** |
| **5. Fly Machines + proxy/gateway** | **Native:** Fly says application code runs in Firecracker microVMs. Prove that each newly created Machine is a fresh Journey boundary. | Machine config accepts a registry image string. Immutable digest resolution and provenance export are **unverified**. | Do not configure Fly secrets or user env vars. Fly injects runtime identifiers and private/public IPv6 addresses; a credential-bearing metadata service is not documented, but absence is **unverified**. | Public ingress is closed by default, but no official deny-by-default outbound hostname policy was found. A separate gateway plus a non-bypassable Machine egress rule is **unverified**; Fly's private IPv6 network is an additional path that must be denied. | **Native:** CPU/memory sizing, rootfs sizing, `auto_destroy`, restart policy, delete/force-delete, and API lifecycle. A hard execution TTL requires an external watchdog. Five-way concurrency needs quota measurement. | Machine events/metrics and billing can be collected, but a complete per-Journey resource/cost/provenance bundle is **added work**. | **Do not spike before Fly identifies a provider-enforced egress mechanism.** |

## Candidate notes and primary sources

### E2B

E2B's first-party site states that every Sandbox is powered by a Firecracker
microVM. Its [Sandbox API](https://e2b.dev/docs/sandbox) documents explicit
timeouts and `kill()`. The current
[create-Sandbox API](https://e2b.dev/docs/api-reference/sandboxes/create-sandbox)
includes `secure`, internet access, `allowOut`, `denyOut`, an `egressProxy`,
environment variables, and volume mounts, but does not define the security
semantics needed by this threat model. Its
[Sandbox-info API](https://e2b.dev/docs/api-reference/sandboxes/get-sandbox)
returns CPU, memory, disk, network policy, and lifecycle state. The
[metrics endpoint](https://e2b.dev/docs/api-reference/envd/get-the-stats-of-the-service)
reports CPU, memory, and disk totals/usage. Lifecycle webhooks include execution
ID, template/build IDs, CPU, memory, and execution time
([official lifecycle-event documentation](https://e2b.dev/docs/sandbox/lifecycle-events-webhooks)).
The [official pricing page](https://e2b.dev/pricing) documents per-second CPU,
memory, and storage charging and at least 20 concurrent Sandboxes on the entry
tier.

The important distinction is that an API field called `allowOut` is not proof of
an allowlist that survives redirects, DNS rebinding, literal IP requests, or
IPv6. E2B must pass the same tests that rejected Vercel Sandbox.

### Self-managed Kubernetes, Kata/Firecracker, Cilium, and proxy

Kata's architecture maps a Kubernetes sandbox Pod to a new VM and supports
selection through Kubernetes `RuntimeClass`
([Kata architecture](https://github.com/kata-containers/kata-containers/blob/main/docs/design/architecture/README.md)).
Kata documents Firecracker as a supported KVM VMM, optimized for single-tenant
microVMs, while noting limited CRI features
([virtualization design](https://github.com/kata-containers/kata-containers/blob/main/docs/design/virtualization.md)).
Its [Firecracker setup guide](https://github.com/kata-containers/kata-containers/blob/main/docs/how-to/how-to-use-kata-containers-with-firecracker.md)
requires containerd, a devmapper snapshotter, the Firecracker/jailer versions
pinned by Kata, and the Kata Firecracker runtime configuration. This is
operationally material, not a turnkey managed service.

Cilium's DNS policy intercepts DNS through a proxy, learns only returned IPs,
and respects TTL
([DNS policy documentation](https://docs.cilium.io/en/stable/security/policy/layer7/)).
Its explicit deny policies take precedence over allow policies
([deny policy documentation](https://docs.cilium.io/en/stable/security/policy/deny/)).
Those mechanisms can deny reserved IPv4/IPv6 ranges even if an allowed hostname
resolves to one. They do not replace an application proxy that validates
redirects and destination resolution at connection time.

Kubernetes documents hard CPU ceilings, memory limits, and local
`ephemeral-storage` limits
([resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)).
Jobs support an execution deadline and automatic cascading cleanup with
`ttlSecondsAfterFinished`
([Job lifecycle](https://kubernetes.io/docs/concepts/workloads/controllers/job/)).
TTL cleanup is eventual, so the runner controller still needs an immediate
delete path and a reconciler.

### Modal

Modal documents that GA Sandboxes use gVisor and do not inherit authorization to
other Modal resources
([networking and security](https://modal.com/docs/guide/sandbox-networking)).
The same page documents a Beta domain allowlist that allows only TLS on port 443
to listed domains and blocks/logs other traffic. Modal also offers a
[Beta VM runtime](https://modal.com/docs/guide/vm-sandboxes), but does not state
which hypervisor it uses or promise a fresh VM per Sandbox.

Modal documents CPU/memory limits and a default per-container 512 GiB disk quota
([resource limits](https://modal.com/docs/guide/resources)), maximum Sandbox
lifetimes and terminal states
([Sandbox lifecycle](https://modal.com/docs/guide/sandboxes)), registry/Dockerfile
images ([existing images](https://modal.com/docs/guide/existing-images)), and
per-second resource billing
([Sandbox resources and pricing](https://modal.com/docs/guide/sandbox-resources)).
The network feature and VM boundary are promising but too new or underspecified
for an authenticated pilot.

### AWS ECS/Fargate

AWS documents that Fargate gives each task a hardware-virtualized environment
without a shared kernel, network interface, storage, CPU, or memory
([Fargate security](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-fargate-ec2.html)).
It also documents that the ECS agent injects the task-metadata endpoint
environment variable into every container
([task metadata v4](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4.html)).
If a task role exists, credentials are served from `169.254.170.2`
([ECS IAM-role guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-iam-roles.html)).

AWS Network Firewall supports hostname allowlists, using HTTP Host and TLS SNI,
but explicitly says it does not perform out-of-band DNS lookups and recommends
separate IP rules
([domain-list rule groups](https://docs.aws.amazon.com/network-firewall/latest/developerguide/stateful-rule-groups-domain-names.html)).
Fargate requires task CPU and memory, and supports 20–200 GiB of encrypted
ephemeral storage with usage exported to Container Insights
([Fargate storage](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-storage.html)).

### Fly Machines

Fly states that application code runs in Firecracker microVMs
([Fly architecture](https://fly.io/docs/reference/architecture/)). The Machines
API documents image selection, CPU/memory configuration, non-persistent rootfs,
`auto_destroy`, and explicit deletion
([Machines resource](https://fly.io/docs/machines/api/machines-resource/)).
The CLI additionally exposes rootfs size
([`fly machine run`](https://fly.io/docs/flyctl/machine-run/)).
Fly documents that Machines are closed to public ingress by default, but the
runtime also receives a private IPv6 address and a public outbound IPv6 address
([runtime environment](https://fly.io/docs/machines/runtime-environment/)).
No first-party documentation found in this research establishes the required
outbound hostname policy or a non-bypassable proxy-only route.

## Recommended Phase 0 spike: E2B behind our proxy

The spike should be deliberately small and should reuse the MEM-7 proof contract
and controlled fixtures.

1. **Preflight the contract before spending compute.** Obtain written E2B
   answers, tied to a product/API version, for:
   - exact `allowOut`/`denyOut` grammar and precedence;
   - IPv4 and IPv6 coverage;
   - whether all TCP, UDP, QUIC, and raw-socket paths honor `egressProxy`;
   - provider metadata addresses and a supported way to make them unreachable;
   - DNS resolution, TTL, rebinding, redirect, SNI, and literal-IP behavior;
   - whether a new Sandbox always means a fresh Firecracker microVM;
   - whether disk size is a hard per-Sandbox limit;
   - immutable template/image provenance and deletion evidence.
   Any unanswered item remains failed; vendor assurance does not replace tests.

2. **Build once, run by immutable identity.** Use the existing Playwright runner
   image as `FROM registry/repository@sha256:…` in an E2B template. Record source
   commit, Dockerfile, base and final digests, SBOM/signature, E2B template ID,
   E2B build ID, Playwright/Chromium/Axe versions, and a runtime filesystem
   fingerprint. Do not install packages at Sandbox startup.

3. **Put policy outside the guest.** Start with internet access denied. If the
   E2B proxy setting is demonstrably mandatory, permit only a dedicated proxy
   endpoint controlled by us. The proxy must:
   - accept only an exact, administrator-versioned hostname set;
   - reject wildcards at public suffixes and reject literal IP authorities;
   - resolve A and AAAA itself and reject loopback, private, link-local,
     multicast, documentation, reserved, and cloud-metadata ranges;
   - pin/revalidate the chosen address for each connection;
   - validate TLS name/SNI and every redirect as a new request;
   - emit content-free policy decisions only.
   Sandbox credentials must not authorize policy changes.

4. **Repeat every MEM-7 attack.** Test unapproved HTTPS, plain HTTP, loopback,
   RFC1918, link-local and metadata, IPv6 local/private/link-local/multicast,
   direct IP, alternate ports, WebSocket, QUIC/UDP, redirect-to-forbidden,
   DNS rebinding with certificate-valid controlled DNS, and attempts to bypass
   or reconfigure the proxy. A reachable metadata service fails even when it
   returns 401.

5. **Prove lifecycle and isolation.** Run five distinct Sandboxes concurrently;
   repeat same-path filesystem, process, environment, and browser-profile
   canaries. Prove irreversible kill and absence/listing after success, runner
   failure, OOM, disk exhaustion, hard timeout, control-plane disconnect, and
   operator cancellation. Run a delayed reconciler and a global kill drill.

6. **Capture a machine-verifiable report.** Include raw provider request IDs and
   timestamps, Sandbox/template/build IDs, image provenance, per-Journey
   startup/runtime/CPU/memory/disk/network metrics, lifecycle events, proxy
   policy decisions, deletion verification, concurrency, and cost calculated
   from the provider invoice/rates. Retain no page content, URLs, headers,
   cookies, trace, DOM, or screenshots in operational telemetry.

### Exit rule

Advance E2B only if every security assertion passes twice in a clean project and
the evidence independently proves the deployed versions and final destruction.
If proxy bypass, metadata reachability, DNS rebinding, IPv6, digest provenance,
or teardown remains unverified, stop managed-provider evaluation and spike the
Kata/Firecracker design next.

## Ranked shortlist

1. **E2B + our external proxy** — best next experiment; managed Firecracker and
   lifecycle fit, with blocking network and metadata claims still unverified.
2. **Self-managed Kubernetes + Kata/Firecracker + Cilium + our proxy** — best
   security-control fit and fallback, with the largest operations/security
   ownership.
3. **Modal VM Sandbox + its domain policy + our proxy** — revisit after the VM
   isolation contract and network semantics are documented and stable.

Fargate and Fly Machines remain useful engineering references, but neither is a
shortlist candidate under the current literal threat model.
