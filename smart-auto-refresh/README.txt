Smart Auto Refresh v1.1.1

功能
- 預設 5 分鐘
- 快捷：1 / 2 / 5 / 10 分鐘
- 自訂分鐘
- 自訂秒數（最低 1 秒）
- 每個分頁獨立設定
- 關閉 popup 後繼續運作

v1.1.1 修正
- 修正由 v1.0 升級至 v1.1 時 Chrome 可能仍保留舊 service worker，令新版 popup 傳 intervalSeconds，但舊 background 仍要求 intervalMinutes，出現「Interval must be at least 1 minute.」
- background service worker 改用新檔名，避免舊 worker cache 混用。
- 1–59 秒改由頁面 timer 處理；60 秒或以上用 chrome.alarms，兼容較嚴格的 Chrome alarm 最低間隔限制。
- 加入舊版 storage migration 及錯誤清理。

安裝 / 升級
1. 解壓 ZIP 到一個新的資料夾。
2. 開 chrome://extensions/。
3. 開啟「開發人員模式」。
4. 最穩陣：移除舊版，再「載入未封裝項目」選新資料夾。
   或者把新檔覆蓋舊資料夾後，必須按該 extension 的「重新載入」按鈕。

注意
- 1–59 秒模式使用網頁 timer。Chrome 對長時間背景分頁可能節流，所以秒數模式並非硬實時保證。
- chrome://、Chrome Web Store 等受保護頁面不能注入 content script，因此秒數模式不可用。
