# Deployment

## Web/API on Vercel

Web/API production deployments are triggered by Git tags that match:

```text
essai-web-v*
```

Production deployments are serialized by the workflow. A release tag deploys unless the current Vercel production deployment is already marked with a newer `essai-web-vX.Y.Z` version. This lets close-together tags deploy in queue order while still preventing older runs from overwriting a newer production deployment.

Normal branch pushes and pull requests should stay as preview deployments. The Web package includes `packages/web/vercel.json` with `github.autoAlias: false` so Vercel's GitHub integration does not automatically alias Git deployments to production. Production is handled by `.github/workflows/deploy-web-production.yml`.

The workflow also has a manual `workflow_dispatch` fallback. Use it for historical tags whose target commits were created before the workflow file existed.

### Vercel project setup

Create or import one Vercel project for the Web/API package.

Recommended project settings:

- Framework Preset: `Next.js`
- Root Directory: `packages/web`
- Install Command: default
- Build Command: default
- Output Directory: default
- Production Branch: `main` is fine because `github.autoAlias` is disabled in `packages/web/vercel.json`. If you want an additional guard, set Production Branch to a branch you do not push to directly and let tag CI be the only production path.

The Root Directory setting is important. Vercel's monorepo docs recommend invoking the CLI from the monorepo root while letting the Vercel project settings provide the package root.

### GitHub secrets

Add these repository secrets in GitHub:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

You can get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from `.vercel/project.json` after linking the project locally with `vercel link --repo`, or from the Vercel project settings/API.

### Vercel environment variables

Add these variables to the Vercel project production environment:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
REQUEST_ENCRYPTION_PRIVATE_JWK
API_KEY_ENCRYPTION_PRIVATE_JWK
```

Provider API keys such as `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, and `ANTHROPIC_API_KEY` are optional for production because the mobile app sends the user's key encrypted per request. They are useful for internal smoke tests.

The matching mobile public-key variables are:

```text
EXPO_PUBLIC_GENERATION_API_BASE_URL
EXPO_PUBLIC_REQUEST_ENCRYPTION_PUBLIC_JWK
EXPO_PUBLIC_API_KEY_ENCRYPTION_PUBLIC_JWK
```

### Release commands

Push code without triggering production:

```bash
git push origin main
```

Push a specific Web/API production release:

```bash
git push origin essai-web-v0.5.3
```

Avoid `git push --tags`. GitHub does not create tag push events when more than three tags are pushed at once, and bulk tag pushes are harder to reason about.

Push release tags one at a time. Historical tags that point to commits before the production marker guard was added should stay local unless you intentionally disable the production workflow while uploading them; otherwise those old commits may run their old workflow definitions.

For guarded historical tags, use GitHub Actions → Deploy Web Production → Run workflow, and enter the tag name, for example:

```text
essai-web-v0.5.3
```
