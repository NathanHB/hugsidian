<div align="center">
  <img src="https://huggingface.co/front/assets/huggingface_logo-noborder.svg" width="80" alt="Hugging Face logo" />
  <h1>Hugsidian</h1>
  <p><strong>Back up your Obsidian vault to a <a href="https://huggingface.co/storage">Hugging Face Bucket</a> — automatically.</strong></p>

  <img src="https://img.shields.io/badge/Obsidian-Plugin-7C3AED?logo=obsidian&logoColor=white" alt="Obsidian Plugin" />
  <img src="https://img.shields.io/badge/Hugging%20Face-Buckets-FFD21E?logo=huggingface&logoColor=black" alt="HF Buckets" />
  <img src="https://img.shields.io/badge/desktop-only-blue" alt="Desktop only" />
</div>

---

Your notes are precious. This plugin keeps them safe by syncing your entire Obsidian vault to a private [Hugging Face Bucket](https://huggingface.co/docs/huggingface_hub/guides/buckets) on a schedule you control.

## Features

- **Automatic periodic sync** — push your vault to HF Buckets every N minutes
- **Full vault backup** — markdown, canvases, PDFs, images, everything
- **Smart deduplication** — only changed files are uploaded (powered by HF's Xet backend)
- **Configurable vault path** — sync any vault, not just the currently open one
- **Auto-detects the `hf` CLI** — no hardcoded paths, works across machines
- **Status bar indicator** — always know when you last synced

## Requirements

- [Hugging Face CLI](https://huggingface.co/docs/huggingface_hub/guides/cli) (`hf`) installed and on your `PATH`
- A Hugging Face account with a [write-access token](https://huggingface.co/settings/tokens)
- An existing HF Bucket (create one with `hf buckets create username/my-vault --private`)

## Installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/NathanHB/obsidian-hf-sync/releases)
2. Copy them to `<your-vault>/.obsidian/plugins/obsidian-hf-sync/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

## Configuration

| Setting | Description |
|---------|-------------|
| **HF Token** | Your HF access token (`hf_...`) with write permissions |
| **Bucket ID** | The target bucket, e.g. `username/my-vault` |
| **Vault path** | Absolute path to the vault. Leave empty to use the currently open vault |
| **hf CLI path** | Path to the `hf` binary. Leave empty to auto-detect from your shell |
| **Sync interval** | How often to sync, in minutes (1–60) |

## Usage

Once configured, the plugin syncs automatically in the background. You'll see the status in Obsidian's bottom status bar:

| Status | Meaning |
|--------|---------|
| `HF ✓ 3m ago` | Last sync was 3 minutes ago |
| `HF ⟳` | Sync in progress |
| `HF ✕` | An error occurred (hover for details) |

To trigger an immediate sync: **Command palette → HF Sync: Sync vault now**

## Restoring your vault

To pull your vault from the bucket onto a new machine:

```bash
hf buckets sync hf://buckets/username/my-vault ./my-vault
```

## Development

```bash
git clone https://github.com/NathanHB/obsidian-hf-sync
cd obsidian-hf-sync
npm install
npm run dev       # watch mode — auto-recompiles on save
```

Symlink the repo into a test vault's plugin folder and reload Obsidian to test changes.

---

<div align="center">
  <sub>Built with ❤️ for the open-source community · <a href="https://huggingface.co/docs/huggingface_hub/guides/buckets">Learn more about HF Buckets</a></sub>
</div>
