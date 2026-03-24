// NSFW-Away — Popup Logic
// Manages the toggle and whitelist UI. Reads/writes directly to storage.local.

const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const toggleEl = document.getElementById('toggle');
const toggleTextEl = document.getElementById('toggle-text');
const disabledNotice = document.getElementById('disabled-notice');
const whitelistInput = document.getElementById('whitelist-input');
const whitelistAddBtn = document.getElementById('whitelist-add');
const whitelistListEl = document.getElementById('whitelist-list');
const whitelistEmptyEl = document.getElementById('whitelist-empty');

let whitelist = [];

// --- Load state ---

async function loadState() {
  try {
    const data = await api.storage.local.get(['enabled', 'whitelist']);

    let enabled = true;
    if (typeof data.enabled === 'boolean') {
      enabled = data.enabled;
    } else if (typeof data.enabled === 'string') {
      enabled = JSON.parse(data.enabled);
    }

    toggleEl.checked = enabled;
    updateToggleUI(enabled);

    if (data.whitelist) {
      whitelist = typeof data.whitelist === 'string' ? JSON.parse(data.whitelist) : data.whitelist;
    }
    renderWhitelist();
  } catch (e) {
    console.error('NSFW-Away Popup: Failed to load state', e);
  }
}

function updateToggleUI(enabled) {
  toggleTextEl.textContent = enabled ? 'Enabled' : 'Disabled';
  disabledNotice.hidden = enabled;
}

// --- Toggle ---

toggleEl.addEventListener('change', async () => {
  const enabled = toggleEl.checked;
  updateToggleUI(enabled);
  try {
    await api.storage.local.set({ enabled });
  } catch (e) {
    console.error('NSFW-Away Popup: Failed to save toggle', e);
  }
});

// --- Whitelist ---

function renderWhitelist() {
  whitelistListEl.innerHTML = '';

  if (whitelist.length === 0) {
    whitelistEmptyEl.hidden = false;
    return;
  }

  whitelistEmptyEl.hidden = true;

  for (const sub of whitelist) {
    const li = document.createElement('li');
    li.className = 'whitelist-item';

    const span = document.createElement('span');
    span.textContent = 'r/' + sub;

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '\u00d7';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => removeFromWhitelist(sub));

    li.appendChild(span);
    li.appendChild(removeBtn);
    whitelistListEl.appendChild(li);
  }
}

async function addToWhitelist(name) {
  const sub = name.trim().toLowerCase().replace(/^r\//, '');
  if (!sub || !/^[a-z0-9_]+$/i.test(sub)) return;
  if (whitelist.includes(sub)) return; // duplicate

  whitelist.push(sub);
  whitelist.sort();

  try {
    await api.storage.local.set({ whitelist: JSON.stringify(whitelist) });
  } catch (e) {
    console.error('NSFW-Away Popup: Failed to save whitelist', e);
  }

  renderWhitelist();
}

async function removeFromWhitelist(sub) {
  whitelist = whitelist.filter(s => s !== sub);

  try {
    await api.storage.local.set({ whitelist: JSON.stringify(whitelist) });
  } catch (e) {
    console.error('NSFW-Away Popup: Failed to save whitelist', e);
  }

  renderWhitelist();
}

whitelistAddBtn.addEventListener('click', () => {
  addToWhitelist(whitelistInput.value);
  whitelistInput.value = '';
  whitelistInput.focus();
});

whitelistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addToWhitelist(whitelistInput.value);
    whitelistInput.value = '';
  }
});

// --- Init ---
loadState();
