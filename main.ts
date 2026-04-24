import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, HFSyncSettingTab, HFSyncSettings } from "./src/settings";
import { SyncEngine } from "./src/sync-engine";

export default class HFSyncPlugin extends Plugin {
  settings: HFSyncSettings;
  syncEngine: SyncEngine;

  private statusBarItem: HTMLElement;
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  async onload() {
    await this.loadSettings();

    this.syncEngine = new SyncEngine(this);
    this.syncEngine.onStatusChange = (status, msg) => this.updateStatusBar(status, msg);

    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar("idle");

    this.addSettingTab(new HFSyncSettingTab(this.app, this));

    this.addCommand({
      id: "hf-sync-now",
      name: "Sync vault now",
      callback: () => this.syncEngine.sync(),
    });

    if (this.isConfigured()) {
      await this.syncEngine.resolveHfPath();
      this.syncEngine.startScheduler();
      this.syncEngine.sync();
    }

    // Refresh the "X min ago" label every minute
    this.clockInterval = setInterval(() => this.updateStatusBar("idle"), 60_000);
  }

  onunload() {
    this.syncEngine.stopScheduler();
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  onSettingsChange() {
    this.syncEngine.restartScheduler();
    if (this.isConfigured()) this.syncEngine.sync();
  }

  private isConfigured(): boolean {
    return Boolean(this.settings.hfToken && this.settings.bucketId);
  }

  private updateStatusBar(status: "idle" | "syncing" | "error", msg?: string) {
    if (status === "syncing") {
      this.statusBarItem.setText("HF ⟳");
      this.statusBarItem.title = "Syncing to HF bucket…";
      return;
    }
    if (status === "error") {
      this.statusBarItem.setText("HF ✕");
      this.statusBarItem.title = `HF sync error: ${msg ?? "unknown error"}`;
      return;
    }
    const last = this.syncEngine.getLastSyncTime();
    if (!last) {
      this.statusBarItem.setText("HF –");
      this.statusBarItem.title = "HF Sync: not yet synced";
      return;
    }
    const mins = Math.floor((Date.now() - last.getTime()) / 60_000);
    const label = mins < 1 ? "just now" : `${mins}m ago`;
    this.statusBarItem.setText(`HF ✓ ${label}`);
    this.statusBarItem.title = `HF Sync: last synced at ${last.toLocaleTimeString()}`;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
