const ALARM_PREFIX = 'autoRefresh:';
// Use chrome.alarms only from 60 seconds upward for maximum compatibility.
// Shorter intervals are handled in the page by content.js.
const ALARM_MIN_SECONDS = 60;

function alarmName(tabId) {
  return `${ALARM_PREFIX}${tabId}`;
}

function normaliseSeconds(stateOrSeconds) {
  if (typeof stateOrSeconds === 'object' && stateOrSeconds !== null) {
    const direct = Number(stateOrSeconds.intervalSeconds);
    if (Number.isFinite(direct)) return direct;
    const legacyMinutes = Number(stateOrSeconds.intervalMinutes);
    if (Number.isFinite(legacyMinutes)) return legacyMinutes * 60;
    return NaN;
  }
  return Number(stateOrSeconds);
}

async function getStates() {
  const { refreshStates = {} } = await chrome.storage.local.get('refreshStates');
  return refreshStates;
}

async function saveState(tabId, state) {
  const refreshStates = await getStates();
  refreshStates[String(tabId)] = state;
  await chrome.storage.local.set({ refreshStates });
}

async function removeState(tabId) {
  const refreshStates = await getStates();
  delete refreshStates[String(tabId)];
  await chrome.storage.local.set({ refreshStates });
}

async function notifyTab(tabId, state) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'APPLY_REFRESH_STATE', state });
    return true;
  } catch {
    return false;
  }
}

async function ensureValidTab(tabId) {
  if (!Number.isInteger(Number(tabId))) {
    throw new Error('找不到目前分頁。');
  }
  return chrome.tabs.get(Number(tabId));
}

async function startRefresh(tabId, intervalSeconds) {
  tabId = Number(tabId);
  const seconds = Number(intervalSeconds);

  if (!Number.isFinite(seconds) || seconds < 1) {
    throw new Error('Interval must be at least 1 second.');
  }

  const tab = await ensureValidTab(tabId);
  const state = {
    enabled: true,
    intervalSeconds: seconds,
    startedAt: Date.now()
  };

  // Always clear a previous alarm when changing mode/interval.
  await chrome.alarms.clear(alarmName(tabId));

  if (seconds >= ALARM_MIN_SECONDS) {
    const minutes = seconds / 60;
    try {
      await chrome.alarms.create(alarmName(tabId), {
        delayInMinutes: minutes,
        periodInMinutes: minutes
      });
      await saveState(tabId, state);
      // Tells content.js to clear any old short timer.
      await notifyTab(tabId, state);
      return;
    } catch (error) {
      await chrome.alarms.clear(alarmName(tabId));
      await removeState(tabId);
      throw error;
    }
  }

  if (!/^https?:/i.test(tab?.url || '')) {
    await removeState(tabId);
    throw new Error('少於 60 秒的設定只支援一般 http/https 網頁。');
  }

  await saveState(tabId, state);
  const notified = await notifyTab(tabId, state);
  if (!notified) {
    await removeState(tabId);
    throw new Error('未能在此網頁啟動秒數模式，請重新整理該網頁後再試。');
  }
}

async function stopRefresh(tabId) {
  tabId = Number(tabId);
  await chrome.alarms.clear(alarmName(tabId));
  await removeState(tabId);
  await notifyTab(tabId, null);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      const inferredTabId = Number(message?.tabId ?? sender?.tab?.id);

      if (message?.type === 'START_REFRESH') {
        // intervalMinutes is kept only as a migration fallback from v1.0.
        const seconds = Number.isFinite(Number(message?.intervalSeconds))
          ? Number(message.intervalSeconds)
          : Number(message?.intervalMinutes) * 60;
        await startRefresh(inferredTabId, seconds);
        sendResponse({ ok: true, version: '1.1.1' });
        return;
      }

      if (message?.type === 'STOP_REFRESH') {
        await stopRefresh(inferredTabId);
        sendResponse({ ok: true, version: '1.1.1' });
        return;
      }

      if (message?.type === 'GET_STATE') {
        const states = await getStates();
        sendResponse({ ok: true, state: states[String(inferredTabId)] || null, version: '1.1.1' });
        return;
      }

      if (message?.type === 'GET_VERSION') {
        sendResponse({ ok: true, version: '1.1.1' });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown message.' });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();

  return true;
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;

  const tabId = Number(alarm.name.slice(ALARM_PREFIX.length));
  if (!Number.isInteger(tabId)) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.id) await chrome.tabs.reload(tabId);
  } catch {
    await chrome.alarms.clear(alarm.name);
    await removeState(tabId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await chrome.alarms.clear(alarmName(tabId));
  await removeState(tabId);
});

async function restoreTimers() {
  const states = await getStates();

  for (const [tabIdText, state] of Object.entries(states)) {
    const tabId = Number(tabIdText);
    if (!state?.enabled || !Number.isInteger(tabId)) continue;

    try {
      const tab = await chrome.tabs.get(tabId);
      const seconds = normaliseSeconds(state);

      if (!Number.isFinite(seconds) || seconds < 1) {
        await removeState(tabId);
        continue;
      }

      // Migrate v1.0 storage to intervalSeconds.
      if (state.intervalSeconds !== seconds || 'intervalMinutes' in state) {
        state.intervalSeconds = seconds;
        delete state.intervalMinutes;
        await saveState(tabId, state);
      }

      if (seconds >= ALARM_MIN_SECONDS) {
        const existing = await chrome.alarms.get(alarmName(tabId));
        if (!existing) {
          await chrome.alarms.create(alarmName(tabId), {
            delayInMinutes: seconds / 60,
            periodInMinutes: seconds / 60
          });
        }
        await notifyTab(tabId, state);
      } else if (/^https?:/i.test(tab?.url || '')) {
        await notifyTab(tabId, state);
      } else {
        await removeState(tabId);
      }
    } catch {
      await chrome.alarms.clear(alarmName(tabId));
      await removeState(tabId);
    }
  }
}

chrome.runtime.onStartup.addListener(restoreTimers);
chrome.runtime.onInstalled.addListener(restoreTimers);
