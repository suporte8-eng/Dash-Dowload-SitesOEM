// content.js

// Indica à página (dashboard) que a extensão está ativa
window.postMessage({ source: "autodownload-extension", type: "EXTENSION_READY" }, "*");

// Escuta mensagens vindas do Dashboard (página web)
window.addEventListener("message", (event) => {
  if (event.data && event.data.source === "autodownload-dash") {
    const { type, scriptId, config, scriptCode } = event.data;

    if (type === "PING") {
      window.postMessage({ source: "autodownload-extension", type: "PONG" }, "*");
    } else if (type === "RUN_SCRIPT") {
      chrome.runtime.sendMessage({
        type: "RUN_SCRIPT",
        scriptId,
        config,
        scriptCode,
        tabId: null // O background vai usar o sender.tab.id
      });
    } else if (type === "PAUSE_SCRIPT") {
      chrome.runtime.sendMessage({ type: "PAUSE_SCRIPT" });
    } else if (type === "RESUME_SCRIPT") {
      chrome.runtime.sendMessage({ type: "RESUME_SCRIPT" });
    } else if (type === "STOP_SCRIPT") {
      chrome.runtime.sendMessage({ type: "STOP_SCRIPT" });
    }
  }
});

// Escuta atualizações de progresso vindas do background e retransmite para o Dashboard
chrome.runtime.onMessage.addListener((message) => {
  if (["PROGRESS", "STATUS", "ERROR", "STATE_CHANGE"].includes(message.type)) {
    window.postMessage({
      source: "autodownload-extension",
      ...message
    }, "*");
  }
});
