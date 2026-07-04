# EssAI

Private product workspace for EssAI.

## Status

EssAI is currently an early `0.x` project.

## Repository

```text
packages/
  mobile/   Mobile app
  web/      Web app and API
```

The repo uses npm workspaces and Turborepo.

## Development

Install dependencies:

```bash
npm install
```

Run the Web/API package:

```bash
npm run dev:web
```

Run the mobile app:

```bash
npm run dev:mobile
```

Run the mobile Web preview:

```bash
npm --workspace @essai/mobile run web
```

## Rights

No license is granted. All rights are reserved for this repository and its current
or prior versions. See [LICENSE](LICENSE).
