# Smart Auto Refresh

Sun's Chrome Manifest V3 extension for per-tab automatic page refresh.

## Stable archive

- Original release candidate: **v1.1.1**
- Package: `smart-auto-refresh-v1.1.1.zip`
- ZIP SHA-256: `6c9182b7fdca97b6c00a2c94536be767ff7e299578032298bfee5c47dc4ea9e8`
- Features: 1/2/5/10-minute quick choices, custom minutes, 1–59 second mode via page timer, independent per-tab settings, persistent background refresh.

## Install

1. Download the official ZIP from this repository's verified **Releases** section (when available).
2. Unzip and open `chrome://extensions/`.
3. Enable **Developer mode**, then choose **Load unpacked** and select the unpacked `smart-auto-refresh` folder that contains `manifest.json`.
4. Chrome does not permit content scripts on internal/browser-protected pages. For 1–59 second intervals, background tab throttling may affect precision.

## Permissions / disclosure

The v1.1.1 source uses `alarms`, `storage`, `tabs`, and `http://*/*` + `https://*/*` host permissions. Wide URL access is used for per-tab content-script refresh and should be reviewed before publishing to Chrome Web Store.

This project is currently public; never commit local profiles, browsing history, credentials, API keys, or personal data.
