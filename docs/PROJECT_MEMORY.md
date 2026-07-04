# EssAI Project Memory

This file records decisions that should survive chat compaction and future sessions.

## Product Shape

- EssAI is a personal creative tool. Mobile is the primary input surface; Web is more for viewing, exporting, and heavier editing.
- User data is local-first on the mobile client. Long-lived product data belongs in local SQLite first, not in a server database.
- Server APIs are stateless generation helpers. They may cache generation results temporarily so the client can recover pending work.
- Authentication is not required for the current phase.
- Users provide their own model API keys. Keys should not be stored by our backend.

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
