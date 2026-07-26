# Accessibility Journey Auditing

This context describes the language used to record, execute, and review
accessibility across user tasks.

## Language

**Project**:
A GitHub repository and its approved audit configuration, journeys, deployments,
sessions, and evidence.
_Avoid_: Workspace, app

**Journey**:
A versioned semantic description of a user task, including setup, user-facing
steps, success assertions, and cleanup.
_Avoid_: Test case, script, workflow

**Journey Version**:
An immutable published form of a Journey that can establish and compare
Baselines.
_Avoid_: Revision, recording

**Control Replay**:
The ordinary semantic execution that proves the Journey and its test data are
currently operable before accessibility-specific comparison.
_Avoid_: Mouse test, happy path

**Keyboard Replay**:
Execution of every user-facing Journey step through a supported deterministic
keyboard interaction pattern.
_Avoid_: Keyboard scan, tab test

**Audit Run**:
One bounded evaluation of one or more published Journeys against an approved
deployment.
_Avoid_: Scan, test run

**Finding**:
An evidence-backed accessibility observation with independent impact,
confidence, and regression state.
_Avoid_: Violation, issue

**Regression**:
A Finding present in a pull-request audit that is absent from a compatible
Baseline.
_Avoid_: Bug, failure

**Baseline**:
A compatible main-deployment Audit Run used to determine whether a Finding is
new, existing, or resolved.
_Avoid_: Snapshot, golden run

**Evidence Bundle**:
The minimum redacted artifacts permitted to support a Finding.
_Avoid_: Trace, dump

**Capability Matrix**:
The versioned public statement of supported browsers, interaction patterns,
automated checks, heuristics, and known limitations.
_Avoid_: Compliance matrix, coverage score

**Audit Engine**:
The versioned deterministic software that executes Journeys, collects evidence,
normalizes Findings, and compares Baselines.
_Avoid_: AI agent, reviewer

**AI Reviewer**:
The optional evidence-grounded service that explains Findings without affecting
their deterministic classification.
_Avoid_: Audit Engine, reasoning agent

