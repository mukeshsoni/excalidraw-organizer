const root = `excalidraw-organizer-chrome-extension-root`;
if (!document.getElementById(root)) {
  const container = document.createElement("div");
  container.id = root;
  container.style =
    "position: absolute; bottom: 0; left: 0; right: 0; z-index: 9999;";
  document.body.appendChild(container);

  // Load the React app
  (async () => {
    // We ask vite to build the app code and put inside /dist/assets/index.js
    // Using rollupOptions.output
    const src = chrome.runtime.getURL("/dist/assets/index.js");
    await import(src);
  })();
}

// chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
//   if (message.message === "toggle-panel") {
//     let container = document.getElementById(
//       "excalidraw-organizer-chrome-extension-root",
//     );
//     if (container) {
//       container.style.display =
//         container.style.display === "none" ? "block" : "none";
//     }
//   }
// });
