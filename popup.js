document.addEventListener('DOMContentLoaded', async () => {
  const toggleSettingsBtn = document.getElementById('toggle-settings');
  const settingsPanel = document.getElementById('settings-panel');

  const notes = await getNotes();
  renderNotes(notes);
  loadSites();

  toggleSettingsBtn?.addEventListener('click', () => {
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('add-site')?.addEventListener('click', () => {
    chrome.storage.local.get(['allowedSites'], (res) => {
      const sites = res.allowedSites || [];
      const input = document.getElementById('site-input');
      if (!input.value) return;
      if (!sites.includes(input.value)) {
        sites.push(input.value);
        chrome.storage.local.set({ allowedSites: sites }, loadSites);
      }
      input.value = '';
    });
  });

  document.getElementById('add-current-site')?.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return;
      const current = new URL(tabs[0].url).origin;
      chrome.storage.local.get(['allowedSites'], (res) => {
        const sites = res.allowedSites || [];
        if (!sites.includes(current)) {
          sites.push(current);
          chrome.storage.local.set({ allowedSites: sites }, loadSites);
        }
      });
    });
  });
});

// === توابع اصلی ===

async function getNotes() {
  const { notes } = await chrome.storage.local.get(['notes']);
  return notes || [];
}

function renderNotes(notes) {
  const list = document.getElementById('notes-list');
  if (!list) return;

  list.innerHTML = '';

  const sorted = notes
    .map((note, index) => ({ ...note, originalIndex: index }))
    .sort((a, b) => {
      const ad = parseShamsiDate(a.date);
      const bd = parseShamsiDate(b.date);
      return ad - bd;
    });

  const today = new Date();

  for (let i = 0; i < sorted.length; i++) {
    const note = sorted[i];
    const item = document.createElement('li');
    item.className = 'note-item';

    const deadline = parseShamsiDate(note.date);
    const diffDays = Math.floor((deadline - today) / (1000 * 60 * 60 * 24)) + 1;

    // رنگ زمینه بر اساس فاصله تا سررسید
    if (!isNaN(diffDays)) {
      if (diffDays < 0) item.style.backgroundColor = 'rgba(50, 50, 50, 0.6)';
      else if (diffDays === 0) item.style.backgroundColor = 'rgba(220, 53, 69, 0.6)';
      else if (diffDays === 1) item.style.backgroundColor = 'rgba(255, 193, 7, 0.6)';
      else if (diffDays === 2) item.style.backgroundColor = 'rgba(255, 243, 205, 0.6)';
      else item.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    }

    item.innerHTML = `
      <div class="note-label" contenteditable="false" spellcheck="false">${note.label}</div>
      <div class="note-date" contenteditable="false" spellcheck="false">${note.date}</div>
      <div class="note-text" contenteditable="false" spellcheck="false">${note.text}</div>
      <button class="edit-note" title="ویرایش" data-original-index="${note.originalIndex}">✏️</button>
      <button class="delete-note" title="حذف" data-original-index="${note.originalIndex}">🗑️</button>
    `;

    list.appendChild(item);
  }

  // فعال/غیرفعال کردن حالت ویرایش
  document.querySelectorAll('.edit-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.parentElement;
      if (!item) return;

      const isEditing = btn.dataset.editing === 'true';

      if (!isEditing) {
        // رفتن به حالت ویرایش
        btn.dataset.editing = 'true';
        btn.textContent = '💾'; // تغییر آیکون به ذخیره
        btn.title = 'ذخیره';

        // فعال کردن contenteditable
        item.querySelectorAll('.note-label, .note-date, .note-text').forEach(el => {
          el.contentEditable = 'true';
          el.classList.add('editable');
        });
        // فوکوس روی اولین فیلد
        item.querySelector('.note-label').focus();
      } else {
        // ذخیره تغییرات
        const index = parseInt(btn.dataset.originalIndex);
        const notes = await getNotes();

        const newLabel = item.querySelector('.note-label').innerText.trim();
        const newDate = item.querySelector('.note-date').innerText.trim();
        const newText = item.querySelector('.note-text').innerText.trim();

        // اعتبارسنجی ساده تاریخ
        if (!newDate.match(/^\d{4}\/\d{1,2}\/\d{1,2}(\s*\|\s*\d{1,2}:\d{2})?$/)) {
          alert('فرمت تاریخ صحیح نیست. باید به شکل yyyy/mm/dd یا yyyy/mm/dd | hh:mm باشد.');
          return;
        }

        notes[index] = {
          ...notes[index],
          label: newLabel,
          date: newDate,
          text: newText,
        };

        await chrome.storage.local.set({ notes });
        renderNotes(notes);
      }
    });
  });

  // حذف یادداشت فقط با آیکون
  document.querySelectorAll('.delete-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.originalIndex);
      const notes = await getNotes();
      notes.splice(index, 1);
      await chrome.storage.local.set({ notes });
      renderNotes(notes);
    });
  });
}

function loadSites() {
  chrome.storage.local.get(['allowedSites'], (res) => {
    const sites = res.allowedSites || [];
    const list = document.getElementById('site-list');
    if (!list) return;

    list.innerHTML = '';
    for (const site of sites) {
      const li = document.createElement('li');
      li.className = 'site-item';
      li.innerHTML = `
        <span>${site}</span>
        <button data-site="${site}">❌</button>
      `;
      li.querySelector('button')?.addEventListener('click', () => {
        const filtered = sites.filter(s => s !== site);
        chrome.storage.local.set({ allowedSites: filtered }, loadSites);
      });
      list.appendChild(li);
    }
  });
}

// === تبدیل تاریخ شمسی به میلادی ===

function parseShamsiDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return new Date(9999, 0, 1);
  const [d, t] = dateStr.split('|').map(s => s.trim());
  const [jy, jm, jd] = d.split('/').map(Number);
  const [h, min] = (t || '00:00').split(':').map(Number);
  const g = toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd, h, min);
}

function toGregorian(jy, jm, jd) {
  let gy;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
    jy -= 0;
  }

  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const gd = days + 1;
  const sal_a = [
    0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31,
    30, 31, 30, 31, 31, 30, 31, 30, 31,
  ];

  let gm;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) {
    days -= sal_a[gm];
  }

  return { gy, gm, gd: days };
}
document.addEventListener('DOMContentLoaded', () => {
  checkLunchReminder();

  document.getElementById('remind-later').addEventListener('click', () => {
    chrome.storage.local.set({ lastNotified: Date.now() });
    hideModal();
  });

  document.getElementById('done').addEventListener('click', () => {
    chrome.storage.local.set({ done: true });
    hideModal();
  });
});

function checkLunchReminder() {
  chrome.storage.local.get(["done", "lastNotified"], (res) => {
    const now = Date.now();
    const done = res.done || false;
    const last = res.lastNotified || 0;
    const diffHours = (now - last) / (1000 * 60 * 60);

    const today = new Date();
    const day = today.getDay(); // 2 = سه‌شنبه
    const shouldStart = day >= 2;

    if (shouldStart && !done && diffHours >= 6) {
      showModal();
    } else {
      hideModal();
    }
  });
}

function showModal() {
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('modal').style.display = 'block';
}

function hideModal() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('modal').style.display = 'none';
}
