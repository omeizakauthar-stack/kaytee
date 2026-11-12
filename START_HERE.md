# Your Mezo Compass app is built

## What to open

Use the **Mezo Compass live preview** in this conversation. It is the production-built app, not a design mockup.

## Try the whole experience without money

1. Click **Start example recovery** on the overview.
2. Click **Simulate example claim**.
3. Read the preview and tick both demo confirmations.
4. Click **Complete example recovery**.

The amounts are fictional. No wallet is opened, no transaction hash is invented, and no money moves.

## Check real mainnet information

1. Choose **Live wallet**.
2. Paste a public wallet address beginning with `0x`.
3. Click **Check wallet**.
4. Use **Evidence & records**, **Transaction history**, and **Recovery center**.

You do not need a private key or any BTC to look up a public address. A browser wallet is optional for checking.

The app reads real protocol records. If a lookup fails, it shows an error rather than replacing it with sample data. History searches show their block range and are not complete account histories.

## What “simulation” means

A simulation asks the blockchain provider what would happen if a claim were attempted. It does not send a real transaction. For an eligible fully redeemed loan with remaining collateral, the app can estimate the claim and its network fee. A simulation is not a guarantee.

## Why the mainnet signing button is locked

The complete wallet-signing code exists and was tested against local test contracts. But it has not received independent review or been exercised in a real mainnet recovery. Because real BTC is involved, this deployment leaves signing off.

An experienced reviewer/operator can enable it using the documented configuration and code-hash checks. You should not enable it merely to make a demo look complete. You can still use Mezo’s official claim guide linked in the app.

## What is finished

- The app/site interface and responsive mobile layout.
- Mainnet wallet checks, loan explanations and surplus checks.
- Supported transaction history, direct transaction lookup and evidence downloads.
- Fictional end-to-end demo.
- Claim simulation and fee preview implementation.
- Guarded wallet signing, transaction tracking and receipt verification code.
- Source code, production build, tests and deployment instructions.

## What is not being claimed

- No mainnet BTC was moved.
- No successful mainnet recovery, positive-surplus mainnet simulation, security audit or prize is claimed.
- The local successful-claim test is not a test of the live Mezo contracts.
- The site has not been published to your own permanent domain or public repository, and no hackathon submission was made.

## How to keep the app

Download the release ZIP. Inside `mezo-compass`, the `README.md` explains how to run and test it. `docs/DEPLOYMENT.md` explains permanent hosting. The ZIP includes a production build under `dist`; rebuilding is recommended when dependencies or configuration change.

A developer can run:

```sh
npm ci
npm run build
npm start
```

No secret or payment is needed to run the default app.
