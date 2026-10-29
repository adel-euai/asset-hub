# Adel | Asset Hub

Private digital asset management system for Adel projects.

## Asset Types

Each project contains:

- Banner — 4 × 1
- Cover — 1.9 × 1
- Logo — 1 × 1
- OG Image — 1.9 × 1
- Screenshots — 1.9 × 1, up to 9
- Sub Logos — 1 × 1, up to 99

Assets are directly replaced. There is no revision, archive, or version history system.

## Architecture

Browser UI → Asset Hub Worker → Central Auth Service / Private GitHub Repository

The GitHub token is never exposed to the browser.

## Configuration

Set these Cloudflare Worker secrets:

```text
AUTH_SERVICE_URL
AUTH_SERVICE_PROJECT
GITHUB_TOKEN
```

The repository owner/name are configured in `wrangler.toml`.

## Development

```bash
npm install
npx wrangler dev
```

## Deployment

```bash
npx wrangler deploy
```

Then set the secrets:

```bash
npx wrangler secret put AUTH_SERVICE_URL
npx wrangler secret put AUTH_SERVICE_PROJECT
npx wrangler secret put GITHUB_TOKEN
```

## GitHub Permissions

The GitHub token should have only the minimum repository permissions required for the private `asset-hub` repository, including repository contents read/write.

## Repository Structure

Each project's assets are stored using stable paths:

```text
projects/
└── project-name/
    ├── banner.png
    ├── cover.png
    ├── logo.png
    ├── og-image.png
    ├── screenshot/
    │   ├── 1.png
    │   ├── 2.png
    │   └── ...9.png
    └── sub-logo/
        ├── 1.png
        ├── 2.png
        └── ...99.png
```

When an asset is replaced, the existing file is overwritten directly at the same path.

The file extension must remain unchanged when replacing an existing asset so that the public asset URL remains stable.

## Notes

The login endpoint is proxied by the Worker to the existing Central Auth Service architecture. If the existing Auth Service uses a different exact request/response contract, update only the Worker authentication adapter; the UI and Asset Hub architecture remain unchanged.

The GitHub repository is private and all repository operations are performed server-side by the Worker.

There is no archive, revision, or version-history system. Each project maintains only its current assets.