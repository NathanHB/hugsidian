# Obsidian HF Sync — Design Spec

**Date:** 2026-04-24  
**Scope:** Upload-only sync from Obsidian vault to a Hugging Face Bucket, with two-way sync as a future extension point.

---

## Goal

An Obsidian plugin that keeps a local vault backed up to a private HF Bucket. Changes made locally are pushed to the bucket periodically. The plugin is invisible during normal use — it runs in the background, shows status in the status bar, and only surfaces when something goes wrong.

---

## Architecture

```
ObsidianHFSyncPlugin (extends Plugin)
├── SettingsTab       — token, bucket ID, sync interval, exclude patterns
├── SyncEngine
│   ├── VaultWatcher  — registers vault events, populates dirty set
│   ├── HFClient      — wraps @huggingface/hub (uploadFiles, commit, listFiles)
│   ├── ManifestStore — persists file hashes + mtimes to JSON
│   └── Scheduler     — setInterval, flushes dirty set every N minutes
└── StatusBar         — idle / syncing / error indicator
```

Each component has a single responsibility and communicates through well-defined interfaces. `SyncEngine` owns the sync lifecycle; `VaultWatcher` and `Scheduler` feed it events; `HFClient` and `ManifestStore` are pure I/O helpers.

---

## Components

### SyncEngine

Owns the sync lifecycle. Exposes two entry points:
- `reconcile()` — called on plugin load; diffs all vault files against the manifest and marks changed files dirty
- `flush()` — called by Scheduler; uploads all dirty files, removes deleted ones, saves manifest

`flush()` is idempotent: if it fails mid-way, the dirty set retains unsynced files and the next cycle retries them.

### VaultWatcher

Registers three vault event listeners via `this.registerEvent()`:
- `vault.on('create', file)` → add to dirty set
- `vault.on('modify', file)` → add to dirty set
- `vault.on('delete', file)` → add to delete queue

Both sets are plain `Set<string>` of vault-relative paths. Debounces `modify` events with a 500ms window to avoid duplicate entries from rapid saves.

### HFClient

Thin wrapper around `@huggingface/hub`. Three methods:
- `upload(files: { path, content: Blob }[])` → `uploadFiles()`
- `remove(paths: string[])` → `commit()` with delete operations
- `list()` → `listFiles()` (used during two-way sync, not in v1)

Throws typed errors (`AuthError`, `NetworkError`) so `SyncEngine` can react appropriately.

### ManifestStore

Reads and writes `.obsidian/plugins/obsidian-hf-sync/manifest.json`.

```json
{
  "version": 1,
  "lastSyncTime": "2026-04-24T10:00:00Z",
  "files": {
    "notes/foo.md": { "hash": "abc123", "size": 1234, "mtime": 1713779400000 }
  }
}
```

Hash is MD5 of file content (fast, not security-sensitive). On startup, `reconcile()` compares each vault file's current mtime + size against the manifest; if either differs, the file is re-hashed to confirm a real change before marking dirty.

### Scheduler

Wraps `setInterval`. Interval is configurable (default 5 minutes). Paused on `AuthError`, resumes when the user updates the token in settings. Cleared in `Plugin.onunload()`.

### StatusBar

Added via `this.addStatusBarItem()`. Three states:
- **Idle:** `HF ✓ 3m ago`
- **Syncing:** `HF ⟳ syncing…`
- **Error:** `HF ✕ error` (hover tooltip shows the error message)

---

## Settings

Stored via `this.loadData()` / `this.saveData()`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `hfToken` | string | `""` | HF access token (write scope required) |
| `bucketId` | string | `""` | e.g. `SaylorTwift/obsidian-vault` |
| `syncIntervalMinutes` | number | `5` | How often to flush the dirty set |
| `excludePatterns` | string[] | `[".obsidian/workspace.json", ".obsidian/workspace-mobile.json"]` | Glob patterns to skip |

The settings tab validates that `hfToken` and `bucketId` are set before enabling the scheduler. Shows a warning banner if either is missing.

---

## Data Flow

### Startup
1. Load settings and manifest
2. Walk all vault files via `vault.getFiles()`
3. For each file not in manifest, or where `mtime`/`size` differ: re-hash → if hash differs, mark dirty
4. Call `flush()`

### During Session
1. Vault events → VaultWatcher → dirty set / delete queue (debounced)
2. Scheduler fires every N minutes → `SyncEngine.flush()`
3. `flush()`:
   - Read each dirty file: text via `vault.read()`, binary via `vault.readBinary()`
   - Batch upload via `HFClient.upload()`
   - Batch delete via `HFClient.remove()`
   - Update manifest entries for uploaded files, remove entries for deleted files
   - Save manifest
   - Update status bar

### Plugin Unload
- Clear scheduler interval
- Flush dirty set one final time (best-effort, no await)

---

## Error Handling

| Error | Behaviour |
|-------|-----------|
| Network failure | Keep dirty set intact, retry next cycle, set status bar to error |
| Auth error (401) | Pause scheduler, show error in status bar, re-enable on token update |
| Upload partial failure | Successfully uploaded files removed from dirty set; failed files remain |
| Manifest write failure | Log warning, continue (next sync will re-diff and recover) |

---

## File Handling

- **Text files** (`.md`, `.canvas`, `.json`, etc.): `vault.read()` → `new Blob([text], { type: "text/plain" })`
- **Binary files** (images, PDFs, etc.): `vault.readBinary()` → `new Blob([uint8Array])`
- **Excluded files**: checked against `excludePatterns` using Obsidian's `normalizePath()` before adding to dirty set

---

## Extension Points for Two-Way Sync (v2)

The design is intentionally structured to make two-way sync addable without rewriting:

- `HFClient.list()` already exists for fetching remote state
- `ManifestStore` tracks the last-known hash, enabling three-way diff (local, remote, base)
- `SyncEngine.flush()` can be extended with a download pass before the upload pass
- Conflict resolution can be added as a `ConflictModal` + new `SyncEngine.resolve()` method

---

## Tech Stack

- **Language:** TypeScript
- **Build:** esbuild (via `esbuild.config.mjs`)
- **HF SDK:** `@huggingface/hub`
- **Hashing:** `spark-md5` (fast, browser-compatible MD5)
- **Obsidian API:** `obsidian` (peer dependency)
- **Min Obsidian version:** 1.4.0
- **Desktop only:** yes (`isDesktopOnly: true` in manifest)

---

## Out of Scope (v1)

- Two-way sync / conflict resolution
- Mobile support
- Selective sync per folder
- Sync history / diff viewer
- End-to-end encryption
