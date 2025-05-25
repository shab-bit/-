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
  }
});