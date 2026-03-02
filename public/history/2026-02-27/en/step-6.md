### 🐛 Bug Fix: Widget Mode Settings Persistence & Crash Fix
- **Settings Save Crash Resolved:** Fixed a background `require is not defined` error that occurred when changing settings, ensuring settings save properly now. (Replaced CommonJS require with ES Module import)
- **Cross-Mode Settings Sync:** Fixed an issue where changing settings in widget mode and returning to normal mode would cause the settings to revert. A local 'settings-updated' synchronization event now ensures all windows and modes constantly share the same up-to-date configuration.
