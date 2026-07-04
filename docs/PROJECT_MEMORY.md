# EssAI Project Memory

This file records decisions that should survive chat compaction and future sessions.

## Product Shape

- EssAI is a personal creative tool. Mobile is the primary input surface; Web is more for viewing, exporting, and heavier editing.
- User data is local-first on the mobile client. Long-lived product data belongs in local SQLite first, not in a server database.
- Server APIs are stateless generation helpers. They may cache generation results temporarily so the client can recover pending work.
- Authentication is not required for the current phase.
- Users provide their own model API keys. Keys should not be stored by our backend.

## Public Repository / License

- If the repository must be public for free deployment, treat public visibility as a hosting constraint only, not as permission for others to use the code.
- Use an `All Rights Reserved / No license is granted` notice rather than an open-source or source-available license.
- The notice should explicitly cover current and prior commits, tags, releases, branches, archives, packages, and other versions made available in the repository.
- Do not grant viewing, review, copying, modification, distribution, production use, hosted service use, competing product use, bulk scraping, or AI/ML training rights without prior written permission.
- This is a soft/legal constraint, not a technical barrier. A public repository can still be accessed, copied, or scraped in practice.
- The project can be made private later. Since no license is granted, previously public code was not intentionally authorized for continued third-party use.

## Release Tagging

- This repo is a monorepo, but release tags should be package/product specific.
- Web/API release tags use the prefix `essai-web-v`, for example `essai-web-v0.1.0`.
- Mobile release tags should use the prefix `essai-mobile-v`, for example `essai-mobile-v0.1.0`.
- Web/API tags are production release triggers. Do not tag pre-monorepo commits with `essai-web-v*`, because the current Vercel project expects the monorepo package layout.
- We are using a single-line release process for now. Every completed, releasable Web/API change should get a tag.
- Not tagging a commit requires a concrete reason, such as:
  - The commit is an incomplete intermediate attempt.
  - The commit is superseded by a later commit that completes the same fix or product decision.
  - The commit only changes mobile or docs and has no Web/API release effect.
- Version bump rules while the major version is `0`:
  - `0.x.0` for feature-level Web/API changes or product-contract changes.
  - `0.x.y` for bug fixes, reliability fixes, provider cleanup, copy/prompt tightening, or deployment compatibility fixes.
  - A new mechanism can still be a patch bump when the product intent is to fix an already-scoped bug or reliability issue rather than add a new user-facing/API-facing feature.
- Prefer annotated tags for releases.
- Current Web/API release series:
  - `essai-web-v0.1.0`: monorepo Web UI baseline.
  - `essai-web-v0.1.1`: deployment/font compatibility fix.
  - `essai-web-v0.2.0`: initial generation API backend.
  - `essai-web-v0.3.0`: generation recovery and follow API.
  - `essai-web-v0.3.1`: duplicate ID/request handling finalized.
  - `essai-web-v0.3.2`: remove mock generation provider.
  - `essai-web-v0.4.0`: rewrite generation payloads.

## Mobile Data

- SQLite is the source of truth on mobile.
- `PRAGMA user_version` is the local database schema version.
- Export/import data has its own `schemaVersion` inside the backup payload.
- Core content fields should use consistent names:
  - `title` for display names/titles.
  - `content` for prompt-relevant body text.
  - Avoid `description` unless a future field is explicitly not prompt-relevant.
- `fragments.title` is non-null. If empty, store the current-language fallback for "New Fragment".
- `schemes.title` is non-null. If empty, store the current-language fallback for "New Scheme".
- `schemes.content` is the scheme body, even if UI labels it as "description".
- `laws.title` and `laws.content` are the rule title and body.
- `scheme_laws.sort` represents display/order sorting.
- `drafts` bind a fragment and scheme. Do not store a duplicate scheme title on `drafts`; join through `scheme_id`.
- `draft_versions` need a unique constraint on `(draft_id, version_no)`.
- Local draft version statuses:
  - `brewing`
  - `completed`
  - `failed`
  - `expired`

## Generation API Direction

- Do not enable Vercel request cancellation for generation routes.
- The generation route may run as a normal synchronous handler:
  - Receive request.
  - Write Redis `running`.
  - Call the provider within the configured deadline.
  - Write Redis `succeeded` or `failed`.
  - Return the final result if the client is still waiting.
- If the client disconnects, the backend should still execute normally as long as the invocation started and stays within `maxDuration`.
- `after` / `waitUntil` are not required for this phase. They are only needed if we intentionally return early and continue work afterward.
- Function max duration target:
  - Vercel route `maxDuration`: 300 seconds.
  - Provider request budget: about 240 seconds.
  - Remaining time is reserved for final Redis writes and response handling.
- Backend generation statuses:
  - `running`
  - `succeeded`
  - `failed`
- Backend should not expose or persist `queued` for the current phase.
- A generation id is unique across the backend cache. Create requests carry a deterministic task-level `requestFingerprint` (`sha256:<hex>`), derived from the generation request itself rather than from user, device, or machine identity.
- If a duplicate generation id has the same request fingerprint, the backend returns `generation_request_exists`; clients should use SSE follow or pull to recover state instead of resubmitting.
- If a duplicate generation id has a different request fingerprint, the backend returns `generation_id_conflict`; clients should treat it as an ID collision and create a new local version id if appropriate.
- Redis TTL is the result cache window, currently 7 days.
- Each generation record also needs a `deadlineAt`.
- If a record exists but is still non-terminal after `deadlineAt`, treat it as timeout failure.
- If a record is missing during recovery, treat it as `expired`.
- SSE is the preferred recovery/follow mechanism for pending local tasks:
  - App startup asks for all local `brewing` remote generation ids.
  - SSE waits and streams terminal updates.
  - Pull remains as a fallback.

## Generation Snapshot

- `draft_versions` must store `snapshot_json`.
- Snapshot means "the generation basis for this exact version", not only a scheme snapshot.
- Scheme-generation snapshot:

```json
{
  "type": "scheme",
  "version": 1,
  "content": {
    "fragment": { "id": "...", "title": "...", "content": "..." },
    "scheme": { "id": "...", "title": "...", "content": "..." },
    "laws": [{ "id": "...", "title": "...", "content": "..." }]
  }
}
```

- Rewrite snapshot:

```json
{
  "type": "rewrite",
  "version": 1,
  "content": {
    "sourceVersionId": "...",
    "sourceContent": "...",
    "instruction": "..."
  }
}
```

- Snapshot should be enough to generate another version without reading current fragment/scheme/law rows.
- Snapshot does not include or reuse the user's provider API key or active model.

## Copy Notes

- Chinese copy should be warmer and more literary.
- English copy should be more grounded and natural, not cold.
- Current Chinese Sparks slogan: `灵光乍现，也有去处。`
- Current English Sparks slogan: `A spark has somewhere to go.`
- Current empty-state idea:
  - Chinese: `先拾起这一点，余下的交给时间。`
  - English: `Pick up this little piece. Let time take care of the rest.`
