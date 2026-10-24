let shortTimer = null;

function clearShortTimer() {
  if (shortTimer !== null) {
    clearTimeout(shortTimer);
    shortTimer = null;
  }
}

function applyState(state) {
  clearShortTimer();

  if (!state?.enabled) return;

  const seconds = Number(state.intervalSeconds ?? (Number(state.intervalMinutes) * 60));
  if (!Number.isFinite(seconds) || seconds < 1 || seconds >= 60) return;

  shortTimer = setTimeout(() => {
    window.location.reload();
  }, seconds * 1000);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'APPLY_REFRESH_STATE') {
    applyState(message.state);
  }
});

(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    applyState(response?.state || null);
  } catch {
    clearShortTimer();
  }
})();
