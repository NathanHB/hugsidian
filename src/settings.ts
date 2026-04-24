import { App, PluginSettingTab, Setting } from "obsidian";
import type HFSyncPlugin from "../main";

export interface HFSyncSettings {
  hfToken: string;
  bucketId: string;
  vaultPath: string;
  hfCmdPath: string;
  syncIntervalMinutes: number;
}

export const DEFAULT_SETTINGS: HFSyncSettings = {
  hfToken: "",
  bucketId: "",
  vaultPath: "",
  hfCmdPath: "",
  syncIntervalMinutes: 5,
};

export class HFSyncSettingTab extends PluginSettingTab {
  plugin: HFSyncPlugin;

  constructor(app: App, plugin: HFSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "HF Sync" });

    const missing = !this.plugin.settings.hfToken || !this.plugin.settings.bucketId;
    if (missing) {
      containerEl.createEl("p", {
        text: "⚠ Set your HF token and bucket ID to enable syncing.",
        cls: "mod-warning",
      });
    }

    new Setting(containerEl)
      .setName("Hugging Face token")
      .setDesc("Access token with write permissions (hf_...).")
      .addText((text) =>
        text
          .setPlaceholder("hf_...")
          .setValue(this.plugin.settings.hfToken)
          .onChange(async (value) => {
            this.plugin.settings.hfToken = value.trim();
            await this.plugin.saveSettings();
            this.plugin.onSettingsChange();
          })
      );

    new Setting(containerEl)
      .setName("Bucket ID")
      .setDesc("e.g. SaylorTwift/obsidian-vault")
      .addText((text) =>
        text
          .setPlaceholder("username/bucket-name")
          .setValue(this.plugin.settings.bucketId)
          .onChange(async (value) => {
            this.plugin.settings.bucketId = value.trim();
            await this.plugin.saveSettings();
            this.plugin.onSettingsChange();
          })
      );

    new Setting(containerEl)
      .setName("Vault path")
      .setDesc(
        "Absolute path to the vault on disk. Leave empty to use the currently open vault."
      )
      .addText((text) =>
        text
          .setPlaceholder("/path/to/vault")
          .setValue(this.plugin.settings.vaultPath)
          .onChange(async (value) => {
            this.plugin.settings.vaultPath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("hf CLI path")
      .setDesc(
        "Path to the hf binary. Leave empty to auto-detect from your shell."
      )
      .addText((text) =>
        text
          .setPlaceholder("/usr/local/bin/hf")
          .setValue(this.plugin.settings.hfCmdPath)
          .onChange(async (value) => {
            this.plugin.settings.hfCmdPath = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.syncEngine.resolveHfPath();
          })
      );

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often to push changes. Min 1, max 60.")
      .addSlider((slider) =>
        slider
          .setLimits(1, 60, 1)
          .setValue(this.plugin.settings.syncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = value;
            await this.plugin.saveSettings();
            this.plugin.syncEngine.restartScheduler();
          })
      );

    new Setting(containerEl)
      .setName("Sync now")
      .setDesc("Trigger an immediate sync.")
      .addButton((btn) =>
        btn
          .setButtonText("Sync now")
          .setCta()
          .onClick(() => this.plugin.syncEngine.sync())
      );
  }
}
