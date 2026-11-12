# Deployment and mainnet release checklist

## Safe production deployment (default)

Use a Node.js host capable of running a long-lived Express server. The GitHub/Render deployment configuration selects Node 22, with a clean production-only install and build verified locally. A static-only upload will not serve the API.

1. Upload/push the application source to a host/repository you control. Choose a license and public/private visibility yourself; neither publication nor account creation was performed here.
2. Install/build: `npm ci && npm run build`.
3. Start: `npm start`. Bind port is `PORT`, default 3000, on `0.0.0.0`.
4. Keep `ENABLE_MAINNET_CLAIMS=false`, with the reviewed-code-hash variables unset.
5. Configure HTTPS, an origin/host you control, hosting-level rate limits and a health check at `/healthz`.
6. Confirm `/api/config` reports `claimsEnabled: false`, then run the browser checks against your host (scripts currently target local port 3000; adjust the test URL when appropriate).
7. Test mainnet RPC failure, privacy disclosures, mobile layouts, address lookups and the fictional demo.

`/healthz` only indicates the process is serving requests. `/api/network` tests live RPC connectivity and chain ID. Outbound HTTPS access to the configured official public RPC endpoints is required.

Environment variables are read from the server process. `.env.example` is a template, not an automatically loaded file. With Node 20.6+ you can use `node --env-file=.env server/index.js` after setting `NODE_ENV=production`; never place wallet keys or phrases in any environment file.

## Docker option

A multi-stage `Dockerfile` and `compose.yaml` are included:

```sh
docker compose up --build
```

The container runs as the non-root `node` user. Its default is signing off. The container image was **not built/run in this environment**, because Docker was unavailable. Check the container build and dependency vulnerability results in your own CI before release.

## Mainnet signing: restricted operator step, not required for the safe demo

Do not enable signing until an experienced reviewer has examined the current deployment, proxy design/administration, ABI compatibility, simulation/receipt assumptions, frontend authorization path, dependencies and this application's code.

1. Verify each official configured proxy address independently against Mezo sources and the explorer.
2. Identify current implementation runtime bytecode for Borrower Operations, Trove Manager and Collateral Surplus Pool. `node scripts/inspect-implementations.js` is a **read-only discovery aid, not a review**.
3. Review those implementations and their upgrade/governance risks. The discovery script reads the standard EIP-1967 implementation slot; proxies using other patterns require separate analysis.
4. Record each reviewed runtime code hash:
   - `REVIEWED_BORROWER_CODE_HASH`
   - `REVIEWED_TROVE_CODE_HASH`
   - `REVIEWED_SURPLUS_CODE_HASH`
5. Only after review and appropriate controlled testing, explicitly set `ENABLE_MAINNET_CLAIMS=true` in the hosting configuration and restart.
6. Verify `/api/config`. It reports enabled only when the explicit flag and all three syntactically valid pins are present. Preview and browser-side rechecks enforce actual code-hash matching. A flag or hash variable is **not** an audit certification.
7. Obtain genuine eligible full-redemption test conditions safely. Do not open risky mainnet loans merely to manufacture a demo, and do not impersonate or claim from another person's wallet.
8. A human owner must connect the matching wallet, use Mezo mainnet, review a fresh preview, accept both confirmations, and authorize the exact transaction in their own wallet.
9. Verify cancellation/rejection, changed account/network/code, fee/amount changes, pending/replaced/reverted transactions and actual payout before broader use.

There are no server-side signing keys or broadcasting endpoints. The browser entry point only prepares the zero-value `claimCollateral()` call to the configured Borrower Operations contract. Token approvals, fund transfers to a new contract, recipient parameters and arbitrary calldata are not supported.

## Verification semantics

- The quoted state, current wallet provider state and user account/network are rechecked before requesting a signature.
- Quote expiry is 60 seconds; changed collateral, gas estimate or gas price requires a new preview.
- The gas limit is estimated with a 30% buffer. The BTC fee budget is not a guarantee or a cap on future network prices; the wallet shows final fees and authorization.
- Pending public address/hash records can be restored from browser storage. Polling is bounded; users can recheck manually. No automatic resubmission occurs.
- Receipt verification requires the exact sender, destination, chain, calldata and zero value, a successful canonical receipt and a matching surplus-pool payout event. A zero surplus or successful unrelated transaction is never enough.
- The displayed surplus and wallet balance after a claim are at the receipt block, not necessarily the current head.
- Two confirmations allow the UI to say the receipt is verified, not that the transaction has irreversible finality.
- A manual replacement hash must itself pass exact-claim verification. An unknown/cancelled/replaced transaction is never silently treated as a payout.

## Privacy and operational hardening

- Explain that public addresses and transaction hashes go to the app server/RPC providers and may be present in infrastructure logs.
- Explain pending-hash local browser storage and how to clear it.
- Review third-party RPC terms, load limits and failure behavior; consider a dedicated provider and independent data checks for public production.
- Add per-client abuse protection, request timeouts/observability, HTTPS, an appropriate Content Security Policy and dependency scanning. Existing global concurrency limits and cache are not complete abuse protection.
- Do not add frame-blocking headers to the Arena preview; for standalone hosting choose embedding policy intentionally.
- Build/run the container if using it. The Node production build has been run; Docker/Compose have only been authored.

## Rollback

Set `ENABLE_MAINNET_CLAIMS=false` and restart to disable new signing requests. Receipt verification remains available. A transaction already approved/broadcast from a user's wallet is not cancelled by this setting. Existing signatures must be managed through the wallet/network, not by pretending they were undone.

## GitHub + Render beginner route

See `../PUBLISH_WITH_GITHUB.md` for upload, exact Web Service settings, billing cautions and post-deploy checks. `render.yaml` is an optional Node 22 Blueprint, not an already-applied deployment.
