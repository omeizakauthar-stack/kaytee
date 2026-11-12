# Release verification · v1.0 MVP

## Passed in this environment

- Clean Linux `npm ci`.
- `npm run build`: production Vite build, including the recovery UI and guarded browser-wallet code.
- `npm test`: **20 passing test cases**, including the local-EVM integration case below.
- `npm run test:browser`: all three browser suites against the Node production server.
- Read-only Mezo mainnet checks: chain ID, code presence, contract relationships, an active loan getter, public redemption-update records and a known transaction receipt.
- Read-only implementation discovery through EIP-1967 slots. Printed hashes were **not** treated as a review or used to enable signing.
- Live mainnet no-loan/ineligible preview: no transaction prepared.

## Successful claim path: LOCAL FIXTURES ONLY

A Ganache EVM was created in memory, and purpose-built Solidity fixtures were compiled/deployed locally. The shared app code then:

1. Checked the local deployment interfaces/relationships.
2. Detected a seeded full-redemption surplus.
3. Simulated the exact zero-value claim and estimated its fee.
4. Enforced account, network, implementation-code pins, quote expiry and fee/amount checks.
5. Sent through the local EIP-1193 wallet provider.
6. Observed a local collateral payout event, successful exact-claim receipt and zero remaining surplus.
7. Waited for a second local block confirmation and reported the receipt verified.

Additional local assertions covered rejection, wrong account/network, missing/changed pins, missing surplus, non-redemption status, unrelated transfer, successful claim without a payout event, and an exact claim that reverted. The fixture contracts are deliberately unsafe testing tools, not copies or forks of the live Mezo deployment.

**No real BTC, public testnet deployment, Mezo mainnet claim, or positive-surplus mainnet simulation was performed.**

## Browser coverage

### Actual production app + live read-only APIs

- Desktop and mobile overview, evidence and history pages.
- Fictional recovery completion; no wallet requests.
- Consent-gated demo button.
- Invalid public address/hash handling.
- Mainnet snapshot and disabled claim for an ineligible address.
- Default signing-off configuration.
- Dialog Escape and no page JavaScript errors/horizontal overflow.
- Bounded real event search, older-page search and known-transaction decoding.
- Simulated provider error without fabricated success.

### Browser API fixtures (NOT mainnet evidence)

- An eligible preview with signing off remains unable to send even after consent.
- Expired preview display.
- Pending hash stored and restored after reload/rechecking the address.
- Receipt status display and JSON download.
- No wallet requests in simulation-only mode.

## Dependency audit

At the release check, `npm audit --omit=dev` reported **0 known advisories** for the production dependency graph. That registry result is time-dependent, not an audit or a safety guarantee.

The full development graph reported **35 advisories** (2 low, 5 moderate, 23 high, 5 critical), including transitive local-testing tooling. Treat these as outstanding development-toolchain risk: keep the local test EVM isolated, compile only trusted fixture input, do not expose it publicly, and review/update or replace the tooling before running untrusted tests. Production installs should use `npm ci --omit=dev` after building. Full/raw reports are included as `dependency-audit.json` and `runtime-audit.json` for transparency.

The lockfile marks Ganache's bundled transitive dependencies as development-only, reflecting Ganache's actual top-level devDependency role; Darwin-only fsevents is optional so Linux clean installs work. Re-run audit after dependency changes.

## Not verified

- Independent code/security audit or genuine human browser-wallet extension compatibility.
- A successful mainnet recovery or a live positive-surplus simulation.
- Historical proxy/ABI compatibility across all previous upgrades.
- Docker/Compose image build/run: Docker was unavailable here. Node production serving was tested.
- Permanent external hosting/domain, public repository publication, real-user validation or hackathon submission.
