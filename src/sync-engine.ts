import { execFile } from "child_process";
import { promisify } from "util";
import type HFSyncPlugin from "../main";

const execFileAsync = promisify(execFile);

export type SyncStatus = "idle" | "syncing" | "error";

// Resolve the `hf` binary path by asking a login shell, so we get the user's
// full PATH regardless of how Obsidian was launched.
async function resolveHfPath(override: string): Promise<string> {
  if (override) return override;
  try {
    const shell = process.env.SHELL ?? "/bin/zsh";
    const { stdout } = await execFileAsync(shell, ["-l", "-c", "which hf"]);
    return stdout.trim();
  } catch {
    return "hf"; // last-ditch fallback
  }
}

export class SyncEngine {
  private plugin: HFSyncPlugin;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastSyncTime: Date | null = null;
  private lastError: string | null = null;
  private running = false;
  private hfPath: string | null = null;

  onStatusChange: (status: SyncStatus, message?: string) => void = () => {};

  constructor(plugin: HFSyncPlugin) {
    this.plugin = plugin;
  }

  // Call once on plugin load (and whenever the override setting changes).
  async resolveHfPath(): Promise<void> {
    this.hfPath = await resolveHfPath(this.plugin.settings.hfCmdPath);
    console.log("[HF Sync] using hf binary:", this.hfPath);
  }

  private getVaultPath(): string {
    const custom = this.plugin.settings.vaultPath;
    if (custom) return custom;
    // basePath is available on the desktop (local filesystem) adapter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.plugin.app.vault.adapter as any).basePath as string;
  }

  private isConfigured(): boolean {
    const { hfToken, bucketId } = this.plugin.settings;
    return Boolean(hfToken && bucketId);
  }

  async sync(): Promise<void> {
    if (this.running || !this.isConfigured()) return;
    if (!this.hfPath) await this.resolveHfPath();

    this.running = true;
    this.onStatusChange("syncing");

    const { hfToken, bucketId } = this.plugin.settings;

    try {
      await execFileAsync(
        this.hfPath!,
        [
          "buckets",
          "sync",
          this.getVaultPath(),
          `hf://buckets/${bucketId}`,
          "--exclude",
          ".DS_Store",
          "--delete",
          "--quiet",
        ],
        {
          env: { ...process.env, HF_TOKEN: hfToken },
        }
      );
      this.lastSyncTime = new Date();
      this.lastError = null;
      this.onStatusChange("idle");
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error("[HF Sync] sync failed:", this.lastError);
      this.onStatusChange("error", this.lastError ?? undefined);
    } finally {
      this.running = false;
    }
  }

  startScheduler(): void {
    this.stopScheduler();
    if (!this.isConfigured()) return;
    const ms = this.plugin.settings.syncIntervalMinutes * 60 * 1000;
    this.intervalId = setInterval(() => this.sync(), ms);
  }

  stopScheduler(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  restartScheduler(): void {
    this.stopScheduler();
    this.startScheduler();
  }

  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  getLastError(): string | null {
    return this.lastError;
  }
}
