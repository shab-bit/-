// === background.js ===
const NOTIF_ID = "lunchReminder";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkReminder", { periodInMinutes: 60 });
  chrome.alarms.create("weeklyReset", { when: getNextTuesdayMidnight(), periodInMinutes: 10080 }); // 7*24*60
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkReminder") {
    shouldRemind((ok) => {
      if (ok) showNotification();
    });
  }

  if (alarm.name === "weeklyReset") {
    chrome.storage.local.set({ done: false });
  }
});

chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
  if (notifId === NOTIF_ID) {
    if (btnIdx === 0) {
      // بعداً یادآوری کن
      chrome.storage.local.set({ lastNotified: Date.now() });
    } else if (btnIdx === 1) {
      // انجام شد
      chrome.storage.local.set({ done: true });
      chrome.notifications.clear(notifId);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveNote") {
    chrome.storage.local.get({ notes: [] }, function (result) {
      const updatedNotes = result.notes;
      updatedNotes.push({
        text: message.text,
        tag: message.tag
      });
      chrome.storage.local.set({ notes: updatedNotes });
    });
  } else if (message.action === "notifyNow") {
    shouldRemind((ok) => {
      if (ok) showNotification();
    });
  }
});

function showNotification() {
  chrome.notifications.create(NOTIF_ID, {
    type: "basic",
    iconUrl: "icon.png",
    title: "🍽️ رزرو غذا یادت نره!",
    message: "سه‌شنبه شده، لطفاً غذا رزرو کن.",
    buttons: [
      { title: "بعداً یادآوری کن" },
      { title: "انجام شد ✅" }
    ],
    priority: 2
  });

  chrome.storage.local.set({ lastNotified: Date.now() });
}

function shouldRemind(callback) {
  chrome.storage.local.get(["done", "lastNotified"], (res) => {
    const now = Date.now();
    const done = res.done || false;
    const last = res.lastNotified || 0;
    const diffHours = (now - last) / (1000 * 60 * 60);

    const today = new Date();
    const day = today.getDay(); // 2 = سه‌شنبه
    const shouldStart = day >= 2;

    if (shouldStart && !done && diffHours >= 6) {
      callback(true);
    } else {
      callback(false);
    }
  });
}

function getNextTuesdayMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + ((2 - now.getDay() + 7) % 7));
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}
