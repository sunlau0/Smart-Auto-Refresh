const toggle = document.getElementById('enabledToggle');
const presets = [...document.querySelectorAll('.preset')];
const customMinutesInput = document.getElementById('customMinutes');
const customSecondsInput = document.getElementById('customSeconds');
const statusCard = document.getElementById('statusCard');
const statusText = document.getElementById('statusText');
const statusHint = document.getElementById('statusHint');
const errorText = document.getElementById('errorText');

let tabId = null;
let selectedSeconds = 300;
let selectionSource = 'preset';
let initialized = false;
let inputUpdateTimer = null;

function showError(message = '') {
  errorText.hidden = !message;
  errorText.textContent = message;
}

function formatInterval(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '5 分鐘';
  if (seconds % 60 === 0) return `${seconds / 60} 分鐘`;
  return `${seconds} 秒`;
}

function clearPresetSelection() {
  presets.forEach((button) => button.classList.remove('active'));
}

function renderPreset(seconds) {
  selectedSeconds = Number(seconds) || 300;
  selectionSource = 'preset';
  presets.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.seconds) === selectedSeconds);
  });
  customMinutesInput.value = '';
  customSecondsInput.value = '';
}

function renderCustomMinutes(minutes) {
  selectedSeconds = Number(minutes) * 60;
  selectionSource = 'minutes';
  clearPresetSelection();
  customSecondsInput.value = '';
}

function renderCustomSeconds(seconds) {
  selectedSeconds = Number(seconds);
  selectionSource = 'seconds';
  clearPresetSelection();
  customMinutesInput.value = '';
}

function renderStatus(enabled, seconds = selectedSeconds) {
  statusCard.classList.toggle('on', enabled);
  statusCard.classList.toggle('off', !enabled);
  statusText.textContent = enabled ? '已啟動' : '未啟動';
  const intervalText = formatInterval(seconds);
  statusHint.textContent = enabled
    ? `每 ${intervalText}重新整理目前分頁`
    : `預設每 ${intervalText}重新整理一次`;
}

async function send(message) {
  return chrome.runtime.sendMessage(message);
}

function getSelectedSeconds() {
  if (selectionSource === 'seconds') {
    return Number(customSecondsInput.value);
  }
  if (selectionSource === 'minutes') {
    return Number(customMinutesInput.value) * 60;
  }
  return selectedSeconds;
}

async function startCurrentTab() {
  showError('');
  const seconds = getSelectedSeconds();

  if (!Number.isFinite(seconds) || seconds < 1) {
    toggle.checked = false;
    showError('請輸入 1 秒或以上。');
    return;
  }

  const response = await send({
    type: 'START_REFRESH',
    tabId,
    intervalSeconds: seconds,
    // Compatibility bridge if Chrome is momentarily still running the v1.0 worker.
    intervalMinutes: seconds / 60
  });

  if (!response?.ok) {
    toggle.checked = false;
    const rawError = response?.error || '啟動失敗。';
    if (/at least 1 minute/i.test(rawError)) {
      showError('Chrome 仲行緊舊版背景程式。請去 chrome://extensions 按一次「重新載入」再試。');
    } else {
      showError(rawError);
    }
    return;
  }

  selectedSeconds = seconds;
  renderStatus(true, seconds);
}

async function stopCurrentTab() {
  showError('');
  const response = await send({ type: 'STOP_REFRESH', tabId });
  if (!response?.ok) {
    toggle.checked = true;
    showError(response?.error || '停止失敗。');
    return;
  }
  renderStatus(false, selectedSeconds);
}

function scheduleLiveUpdate() {
  clearTimeout(inputUpdateTimer);
  inputUpdateTimer = setTimeout(async () => {
    const seconds = getSelectedSeconds();
    if (!Number.isFinite(seconds) || seconds < 1) return;

    if (toggle.checked && initialized) {
      await startCurrentTab();
    } else {
      renderStatus(false, seconds);
    }
  }, 250);
}

presets.forEach((button) => {
  button.addEventListener('click', async () => {
    const seconds = Number(button.dataset.seconds);
    renderPreset(seconds);

    if (toggle.checked && initialized) {
      await startCurrentTab();
    } else {
      renderStatus(false, seconds);
    }
  });
});

customMinutesInput.addEventListener('input', () => {
  const minutes = Number(customMinutesInput.value);
  selectionSource = 'minutes';
  clearPresetSelection();
  customSecondsInput.value = '';

  if (Number.isFinite(minutes) && minutes >= 1) {
    renderCustomMinutes(minutes);
    scheduleLiveUpdate();
  }
});

customSecondsInput.addEventListener('input', () => {
  const seconds = Number(customSecondsInput.value);
  selectionSource = 'seconds';
  clearPresetSelection();
  customMinutesInput.value = '';

  if (Number.isFinite(seconds) && seconds >= 1) {
    renderCustomSeconds(seconds);
    scheduleLiveUpdate();
  }
});

toggle.addEventListener('change', async () => {
  if (!initialized) return;
  if (toggle.checked) {
    await startCurrentTab();
  } else {
    await stopCurrentTab();
  }
});

(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('找不到目前分頁。');
    tabId = tab.id;

    const response = await send({ type: 'GET_STATE', tabId });
    const state = response?.state;

    if (state?.enabled) {
      const seconds = Number(state.intervalSeconds ?? (Number(state.intervalMinutes) * 60)) || 300;
      const presetValues = presets.map((b) => Number(b.dataset.seconds));
      const isPreset = presetValues.includes(seconds);

      toggle.checked = true;

      if (isPreset) {
        renderPreset(seconds);
      } else if (seconds % 60 === 0) {
        const minutes = seconds / 60;
        customMinutesInput.value = minutes;
        renderCustomMinutes(minutes);
        customMinutesInput.value = minutes;
      } else {
        customSecondsInput.value = seconds;
        renderCustomSeconds(seconds);
        customSecondsInput.value = seconds;
      }

      renderStatus(true, seconds);
    } else {
      toggle.checked = false;
      renderPreset(300);
      renderStatus(false, 300);
    }

    initialized = true;
  } catch (error) {
    showError(error?.message || String(error));
    toggle.disabled = true;
  }
})();
