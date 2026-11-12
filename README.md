# Mezo Compass · v1.0 MVP

A responsive app/site for understanding Mezo MUSD loans, tracing supported protocol events, and preparing a collateral recovery after a full redemption.

**This release completes the MVP implementation—not an independent security audit, a proven mainnet recovery, or a hackathon submission.** The running deployment defaults to mainnet reads, simulations and receipt checks, with mainnet signing **off**.

## Try it

1. Open the app and choose **Start example recovery**.
2. Select **Simulate example claim**, review the fictional preview, accept the two demo confirmations, and complete the walkthrough. No wallet is used and no real transaction is created.
3. Choose **Live wallet** to check a public `0x…` address on Mezo mainnet.
4. Open **Transaction history** to search supported events or inspect a known transaction hash.
5. Open **Recovery center** to simulate an eligible full-redemption claim or track an existing claim transaction.

See `START_HERE.md` for the plain-language handoff, `docs/DEPLOYMENT.md` for deployment/signing controls, and `docs/TEST_RESULTS.md` for verification and outstanding risks.

## Publish from GitHub

See `PUBLISH_WITH_GITHUB.md`. A Render `render.yaml` is included with a free demo plan, Node 22 and signing off. No remote resource has been created. A production-only install and build were checked on Node 22; creating and approving hosting still requires your own account.

## Run locally

Node.js 20+, npm, outbound HTTPS:

```sh
npm ci
npm run dev
```

Open port 3000. No account, API key, private key, wallet phrase, or funds are required.

Production:

```sh
npm ci
npm run build
npm start
```

The server listens on `0.0.0.0`, uses `PORT` or 3000, and serves both the app and same-origin `/api` routes. `/healthz` checks process health, not RPC health. A Node server is required; this is not a static-only site.

## Implemented

- Mezo mainnet chain 31612; BTC gas; addresses sourced from the official MUSD deployment artifacts.
- Read-only public-address inspection, or injected EVM-wallet address connection.
- Block-scoped loan status, surplus, BTC/MUSD balances, active loan collateral and debt including pending redistribution through the correct getter.
- Plain-English explanations without confusing liquidation, redemption, owner closure, absent record, or unknown status.
- Chain ID, deployed-code presence, token decimals and selected contract cross-reference checks.
- Bounded 5,000-block pages of supported wallet-indexed events; emitter-specific operation decoding; transaction links; explicit partial coverage.
- Receipt lookup for known transactions, ignoring unrelated wallets, unsupported emitters, removed logs and failed receipts as evidence of successful activity.
- Claim preview: full-redemption eligibility, current surplus, exact zero-value `claimCollateral()` simulation, fee estimate with a 30% gas-limit buffer, gas-balance check, 60-second preview expiry.
- Guarded wallet signing implementation: explicit deployment enable plus three implementation-code hash pins; own-wallet provider re-simulation; exact account, chain, calldata, zero value, fresh amounts and fee checks; two user confirmations and wallet approval.
- Pending transaction persistence in browser storage, reload recovery after re-checking the wallet, bounded polling, manual replacement-hash tracking, no auto-resubmission.
- Claim verification checks exact sender, destination, calldata, value, chain, successful canonical receipt, matching pool payout event, receipt-block surplus, wallet balance and at least two confirmations. Two confirmations are **not** a finality guarantee.
- Fictional end-to-end demo, responsive desktop/mobile layouts, exports, official guide links, dialog Escape/focus handling, error/empty/loading states.
- Production build, Dockerfile, Compose configuration, environment example, test fixtures and deployment guide.

## Signing is off by default

There is no server signing or broadcasting endpoint. Only the user's browser wallet can send the claim. In this delivered deployment the wallet-signing button cannot be enabled through the UI.

Signing requires all of the following deployment settings:

- `ENABLE_MAINNET_CLAIMS=true`
- `REVIEWED_BORROWER_CODE_HASH`
- `REVIEWED_TROVE_CODE_HASH`
- `REVIEWED_SURPLUS_CODE_HASH`

The three values are hashes of reviewed implementation runtime code. The names and settings do not themselves certify a review. The app checks them against current implementation code; it does not audit that code or prove the trustworthiness of proxy administration. **Do not enable signing merely because a script can print hashes.** See `docs/DEPLOYMENT.md`.

## Tests

```sh
npm test
npm run build
npm run test:live
# Read-only optional address check:
node scripts/verify-network.js 0xYOUR_PUBLIC_ADDRESS
# Install browser dependencies; keep the site running in another terminal:
npx playwright install --with-deps chromium
npm run test:browser
```

### What was exercised

- **20 automated test cases**, including a local-EVM integration case with multiple assertions.
- Local test fixture: simulation, signing through an EIP-1193 provider, exact zero-value claim, real local payout, two-confirmation receipt and zero remaining surplus.
- Local negative cases: no surplus, non-redemption status, wrong network/account, missing/changed pins, rejected wallet request, unrelated transaction, missing payout event, reverted claim, and repeated-claim prevention through fresh surplus checks.
- Live **read-only** mainnet deployment/status/active-loan reads, real redemption-update events and a known transaction receipt.
- Production-browser desktop/mobile flows, full fictional recovery, consent gates, default signing lock, address/hash validation, history paging, API failure without fabricated success and no horizontal overflow/page errors.
- Browser API fixtures (explicitly not mainnet evidence) for expired preview, pending hash reload, verified receipt display/export, and no wallet requests in simulation-only mode.

### Not exercised or completed

- **No real mainnet claim or positive-surplus mainnet simulation has been demonstrated.** The successful claim test uses small purpose-built **local fixtures**, not a fork of the deployed Mezo contracts and not real BTC.
- No independent smart-contract/security audit or human browser-wallet compatibility review.
- Docker/Compose files were authored; Docker was unavailable here, so the container image was not built or run. The Node production build was run and browser-tested.
- No permanent public hosting, domain, public repository publication, account creation, or hackathon submission. The Arena live preview is not permanent hosting.
- No user validation, competition/novelty claim, financial advice or guaranteed prize.
- Development/test dependencies have known advisories; do not expose the local fixture EVM or run untrusted tests. The production-only graph reported zero known advisories at this check, not a guarantee. See `docs/TEST_RESULTS.md` and the included audit JSON reports.

## Security, privacy and limits

- No private keys, phrases, fund custody, token approvals, automatic claims, or unlock payments.
- Address inspections go through the app server and public RPC providers. They may appear in infrastructure/provider logs. An in-memory address snapshot cache lasts 15 seconds with at most 100 entries; there is no user database.
- A pending claim's public wallet address/hash is stored in the browser until verified/reverted, or until the user clears storage. Do not confuse that record with proof of settlement.
- Selected read-only snapshots use head minus two blocks with staleness checks, not asserted finality. History coverage is partial; historical ABI/proxy upgrades are not independently audited.
- Fee budgets are estimates and change. The wallet shows final authorization and fees. Simulations cannot prevent all onchain state changes or malicious provider responses.
- RPC providers remain trust dependencies. Code presence/cross-references/pins are not a security audit or cryptographic proof.
- Five shared concurrent evidence/inspection requests and bounded scans reduce load but are not full production abuse protection. Add hosting-level rate limits, HTTPS, monitoring, dependency review and appropriate security headers/CSP before public production.
- Claims support only the narrow full-redemption case. A surplus from another workflow is not automatically claimed by this app.

## Code map

- `src/main.jsx`, `src/styles.css`: interface and navigation.
- `src/History.jsx`: bounded event search and receipt UI.
- `src/ClaimFlow.jsx`: demo, preview, consent, pending/replacement/verification UI.
- `src/claim-core.js`: shared simulation, eligibility, pins and receipt verification.
- `src/wallet-claim.js`: guarded browser-wallet send entry point.
- `src/protocol.js`: ABI and relationship checks shared between browser/server.
- `server/`: Express read-only API, RPC fallback, history and claim configuration.
- `tests/fixtures/RecoveryFixture.sol`: **unsafe local test contracts only; never deploy them to a public network**.
- `docs/mainnet-*.json`: sourced deployment addresses/ABIs. Earlier testnet research artifacts are not active configuration.

## Sources

- Network: https://mezo.org/docs/developers/getting-started/
- Official recovery guide: https://mezo.org/docs/users/borrow/claim-collateral-after-redemption/
- Official artifacts: https://github.com/mezo-org/musd/tree/main/solidity/artifacts/deployments/mainnet
- Protocol source: https://github.com/mezo-org/musd/tree/main/solidity/contracts

The read-only public event fixture in `docs/live-evidence-fixture.json` is not our wallet or transaction and does not demonstrate recovery.

## Before hackathon submission

Validate the borrower problem and competitor overlap, get experienced review and organizer feedback, establish a legitimate reproducible protocol integration case, publish the code with an appropriate license and host the site permanently, then prepare the deck and two-minute video. This release is not a submission or a promise of winnings.
