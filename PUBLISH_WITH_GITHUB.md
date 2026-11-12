# Publish Mezo Compass using your GitHub account

## Current status

The code and deployment configuration are prepared. A clean production-only dependency install and production build succeeded using Node 22. No GitHub repository, Render account, hosting resource, billing commitment, or external deployment has been created for you.

You will perform account login and approve publishing yourself. Never share passwords, access tokens, private keys, wallet phrases or billing details in this conversation.

## 1. Upload the project to GitHub

1. Download **Mezo-Compass-GitHub-Upload.zip** from this conversation and extract it on your computer.
2. Sign in to GitHub and open https://github.com/new .
3. Name the repository **mezo-compass** (or another name you prefer).
4. Choose repository visibility deliberately. A **Public** repository exposes the source to everyone and may be needed for the hackathon; **Private** is also usable with an authorized hosting connection. Do not publish anything you do not have permission to disclose.
5. Create the repository. You do not need to add a separate README; this project already includes one.
6. On the empty repository page choose **uploading an existing file**. On an existing repository use **Add file → Upload files**.
7. Drag the **contents of the extracted project folder** into the upload area, preserving folders such as `src`, `server`, `docs`, `scripts`, and `tests`.
8. Click **Commit changes**.

**Do not upload the ZIP itself. Do not upload only `dist`. Do not add an extra parent `mezo-compass` folder above the project files.**

Your repository homepage should show these directly at the top level:

```text
package.json
package-lock.json
index.html
render.yaml
src/
server/
docs/
README.md
```

Hidden files such as `.node-version` may not appear in your computer's default file picker. The manual Render settings below explicitly select Node 22, so missing that hidden file will not silently force an untested Node version. Do not upload a real `.env` file; `.env.example` is only a safe template with signing off.

If you want help checking the upload, send only the **public repository URL**, not a token or password. If the repository is private, you can instead share a screenshot of its file list with private account details hidden.

## 2. Create a Render account and connect your repository

1. Open https://dashboard.render.com/register .
2. Create/sign in to your Render account. If you use GitHub login, review the requested access yourself.
3. In Render choose **New → Web Service**. **Do not choose Static Site**: this app needs its Node API server.
4. Connect GitHub and authorize access only to the repository you want to deploy.
5. Select your `mezo-compass` repository.

No database, wallet connection, secret, custom domain, or API key is required for this demo deployment.

## 3. Enter these web-service settings

| Field | Value |
|---|---|
| Name | `mezo-compass`, or an available name you prefer |
| Branch | Your uploaded branch, usually `main` |
| Language/runtime | **Node** (choose it explicitly if the Dockerfile causes another suggestion) |
| Root Directory | **Leave blank**, assuming `package.json` is at repository root |
| Build Command | `npm ci --omit=dev --no-audit --no-fund && npm run build` |
| Start Command | `npm start` |
| Instance/compute plan | **Free**, if offered |
| Health Check Path | `/healthz` |
| Auto Deploy | **Off/manual**, initially |

Add these environment variables:

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `ENABLE_MAINNET_CLAIMS` | `false` |

Do not add private keys or code-hash pins. Mainnet signing must remain off for this unaudited demo.

Before approving, review the displayed plan and billing terms. **If Free is unavailable, the dashboard requires a payment method, or anything shows a charge you do not want, stop and tell me. Do not approve a paid plan just to follow this guide.**

The included `render.yaml` is an optional Blueprint alternative with a free demo web service and signing off. For a first deployment, the manual Web Service path above makes each setting visible. Creating a Blueprint would still require your account authorization and review; no Blueprint has been applied here.

## 4. Approve deployment and test the resulting URL

After reviewing settings, click Render's deployment/create button. Watch the build logs. The app should report that it is serving requests and mainnet signing is disabled.

Use the exact website URL Render actually provides. Do not assume the name you requested guarantees a particular URL.

Check:

1. The site opens and the fictional recovery walkthrough completes without opening a wallet.
2. Append `/healthz` to the URL: it should return JSON with `status: "ok"`.
3. Append `/api/config`: it should show `claimsEnabled: false`.
4. A public wallet lookup works, or clearly reports an RPC failure without fabricated sample data.
5. Supported history/transaction checks and exports work.
6. The phone layout works.

You can then share that actual URL with me for a public-page/health/config check. I cannot inspect private Render logs unless you share a non-sensitive excerpt.

## Free-hosting limits matter for demos

Render says Free web services sleep after 15 minutes without inbound traffic and may take about a minute to wake. They have usage limits and are not recommended for production applications. If you add a payment method, supplementary usage can incur charges; review spend controls and billing terms. Without a payment method, some exceeded limits suspend service or builds instead. This is a demo option, not a promise of permanent free or uninterrupted hosting.

Before a judging/demo session, open the actual site early and let it finish waking up. Do not use artificial traffic to evade host limits.

This deployment keeps signing off, uses no server-side user database, and does not need a persistent disk. Existing browser-side pending-hash records are not server-side proof of settlement.

## Common deployment errors

- **`package.json` not found:** the files are probably nested in an extra folder. Move the project contents to repository root, or deliberately set Root Directory to that folder.
- **The page opens but `/api` calls fail:** you probably deployed as Static Site, or uploaded only the compiled frontend. Use a Node Web Service with all server/source/ABI files.
- **Missing `dist/index.html`:** verify the Build Command includes `npm run build` and that it finished successfully.
- **Missing mainnet ABI JSON files:** upload the `docs` folder; `server/history.js` reads those files at startup.
- **Wrong Node version:** explicitly set `NODE_VERSION=22` and redeploy.
- **RPC failures:** do not enable signing or insert fake data. Share the non-sensitive error and public URL for diagnosis.
- **A paid plan or card is required:** stop rather than accepting an unexpected charge.

## Official references

- Node/Express Web Service: https://render.com/docs/deploy-node-express-app
- Node version selection: https://render.com/docs/node-version
- Free service limits/billing behavior: https://render.com/docs/free
- Optional Blueprint syntax: https://render.com/docs/blueprint-spec
