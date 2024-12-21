chrome.action.onClicked.addListener(async (tab) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Send a message to the content script in the active tab
    chrome.tabs.sendMessage(tabs[0].id, { message: "toggle-panel" });
  });
});
