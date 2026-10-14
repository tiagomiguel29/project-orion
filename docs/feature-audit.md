# Feature audit — 14 October 2026

The local development stack and the isolated three-replica scale stack were exercised against the landing page's claims. Test devices and telemetry in this audit are disposable fixtures; the scale stack was stopped after the check.

| Claim | Verification | Result |
| --- | --- | --- |
| Host CPU, RAM, disk, network, temperature, hardware, OS, uptime and last seen | Real Go agent → gRPC → PostgreSQL → REST/WebSocket → browser | Passed |
| Eleven history ranges and bounded charts | Browser controls and SVG checks; 2,001-point synthetic histories on all eleven ranges across three replicas; 20 client chart tests | Passed; server range results stayed within the documented 13–121 numeric-point budgets |
| Docker container detail | Real agent detected 16 local containers; synthetic unhealthy container reached the UI with CPU, RAM and network values | Passed |
| Cloudflare tunnel detail | Two local cloudflared simulators with separate metrics endpoints and tunnel IDs → real Go agent → gRPC → PostgreSQL → device detail API; synthetic labelled metrics → browser | Passed in simulation; no real Cloudflare tunnel was running locally |
| Account sign-in, enrollment and MFA | Valid/invalid password, device registration, TOTP setup, invalid code rejection, MFA login and pending-token isolation | Passed; the disposable account's TOTP state was restored |
| Passkeys | Software WebAuthn authenticator registered, signed in with MFA, rejected an unverified registration and invalid signature, blocked pending-token API access and assertion replay, then removed the test passkey | Passed locally; no physical authenticator was tested |
| Buffering, retry, deduplication and horizontal scaling | Go tests, real-agent flow, three-replica transactional duplicate/rollback tests, 100-batch burst, replica/Redis restart and TLS proxy | Passed |
| Landing page | Production build, desktop/mobile width checks, all eleven demo ranges, device switcher, simulated load, pause/resume, setup guide and command copy | Passed |

The audit corrected Cloudflare metrics discovery/identification across multiple processes, Docker unhealthy-status parsing, passkey verification error handling, the agent smoke-test process lifecycle, the dashboard's free-disk formatting and offline “Live” indicator, and the missing web lint configuration. Backend unit tests (44), agent tests, web lint/typecheck, landing build and dashboard production build passed. The existing backend lint command still reports hundreds of pre-existing formatting/type-lint errors; it is not a passing project-wide check.
