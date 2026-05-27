// background.js
import { registry } from './scripts/registry.js';

let appState = "idle"; // idle | running | paused
let currentTabId = null;
let currentScriptId = null;

// Mantém um Map com os metadados dos scripts locais
const scriptMap = {};
for (const id in registry) {
  const s = registry[id];
  scriptMap[id] = {
    id: id,
    name: s.name,
    version: s.version,
    author: s.author,
    matchUrls: s.matchUrls,
    description: s.description,
    configSchema: s.configSchema
  };
}

// Ouvir conexões e mensagens
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SCRIPTS") {
    sendResponse({ scripts: scriptMap });
    return true;
  }

  if (message.type === "GET_CURRENT_STATE") {
    sendResponse({ state: appState, scriptId: currentScriptId, tabId: currentTabId });
    return true;
  }

  if (message.type === "RUN_SCRIPT") {
    const { scriptId, config, tabId, scriptCode } = message;
    const targetTabId = tabId || (sender.tab && sender.tab.id);
    if (targetTabId) {
      startScriptExecution(scriptId, config, targetTabId, scriptCode);
    } else {
      chrome.runtime.sendMessage({ type: "ERROR", message: "Aba de execução não encontrada." }).catch(() => {});
    }
  }

  if (message.type === "PAUSE_SCRIPT") {
    appState = "paused";
    notifyStateChange();
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: "PAUSE" }).catch(() => {});
    }
  }

  if (message.type === "RESUME_SCRIPT") {
    appState = "running";
    notifyStateChange();
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: "RESUME" }).catch(() => {});
    }
  }

  if (message.type === "STOP_SCRIPT") {
    appState = "idle";
    notifyStateChange();
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: "STOP" }).catch(() => {});
    }
    currentTabId = null;
    currentScriptId = null;
  }

  if (["PROGRESS", "STATUS", "ERROR"].includes(message.type)) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  if (message.type === "SCRIPT_FINISHED") {
    appState = "idle";
    notifyStateChange();
    chrome.runtime.sendMessage({ 
      type: "STATUS", 
      message: `Finalizado: ${message.result.success} sucesso, ${message.result.errors} erros.` 
    }).catch(() => {});
    currentTabId = null;
    currentScriptId = null;
  }
});

function notifyStateChange() {
  chrome.runtime.sendMessage({ type: "STATE_CHANGE", state: appState }).catch(() => {});
}

async function startScriptExecution(scriptId, config, tabId, scriptCode) {
  appState = "running";
  currentTabId = tabId;
  currentScriptId = scriptId;
  notifyStateChange();

  // Garante que o content script está injetado
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content.js"]
    });
  } catch (err) {
    console.log("Injeção do content.js pulada ou já ativa:", err);
  }

  // Se o código do script não foi enviado diretamente, tenta pegar do registro local da extensão
  let finalScriptCode = scriptCode;
  if (!finalScriptCode && registry[scriptId]) {
    // Para rodar a partir do popup, pegamos a função diretamente do registro
    finalScriptCode = registry[scriptId].run.toString();
  }

  if (!finalScriptCode) {
    appState = "idle";
    notifyStateChange();
    chrome.runtime.sendMessage({ type: "ERROR", message: "Código do script não encontrado." });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: executeScriptOnTab,
    args: [finalScriptCode, config]
  }).catch((err) => {
    appState = "idle";
    notifyStateChange();
    chrome.runtime.sendMessage({ type: "ERROR", message: `Falha ao iniciar: ${err.message}` });
  });
}

function executeScriptOnTab(runFuncStr, config) {
  if (window.activeAutoDownloadRunner) {
    window.activeAutoDownloadRunner.stop();
  }

  let isPaused = false;
  let pauseResolver = null;
  const abortController = new AbortController();

  const signals = {
    get isPaused() { return isPaused; },
    get pause() {
      if (!isPaused) return Promise.resolve();
      return new Promise(resolve => {
        pauseResolver = resolve;
      });
    },
    stop: abortController
  };

  const messageListener = (msg) => {
    if (msg.type === "PAUSE") {
      isPaused = true;
    } else if (msg.type === "RESUME") {
      isPaused = false;
      if (pauseResolver) {
        pauseResolver();
        pauseResolver = null;
      }
    } else if (msg.type === "STOP") {
      abortController.abort();
      cleanup();
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  const cleanup = () => {
    chrome.runtime.onMessage.removeListener(messageListener);
    delete window.activeAutoDownloadRunner;
  };

  window.activeAutoDownloadRunner = {
    stop: () => {
      abortController.abort();
      cleanup();
    }
  };

  // Se o código for um módulo export default completo (como o lido dos arquivos do repositório)
  let runFn;
  let cleanCode = runFuncStr.trim();
  
  if (cleanCode.includes("export default")) {
    // Converte o export default para um objeto executável
    // Ex: export default { run: async ... } -> window.__temp = { run: async ... }
    const tempVarName = "__auto_dl_temp_" + Date.now();
    cleanCode = cleanCode.replace(/export\s+default\s+/, `window.${tempVarName} = `);
    
    const scriptEl = document.createElement("script");
    scriptEl.textContent = cleanCode;
    document.documentElement.appendChild(scriptEl);
    const loadedModule = window[tempVarName];
    scriptEl.remove();
    delete window[tempVarName];

    if (loadedModule && typeof loadedModule.run === "function") {
      runFn = loadedModule.run;
    } else {
      chrome.runtime.sendMessage({ type: "ERROR", message: "Estrutura do script de exportação inválida." });
      cleanup();
      return;
    }
  } else {
    // Se for apenas o corpo serializado da função run
    if (cleanCode.startsWith("async")) {
      runFn = new Function(`return (${cleanCode})`)();
    } else {
      runFn = new Function(`return (async ${cleanCode})`)();
    }
  }

  // Executa o script
  runFn(config, signals, (progressEvent) => {
    chrome.runtime.sendMessage(progressEvent);
  }).then((result) => {
    chrome.runtime.sendMessage({ type: "SCRIPT_FINISHED", result });
    cleanup();
  }).catch((err) => {
    chrome.runtime.sendMessage({ type: "ERROR", message: `Erro na execução: ${err.message}` });
    chrome.runtime.sendMessage({ type: "SCRIPT_FINISHED", result: { total: 0, success: 0, errors: 1 } });
    cleanup();
  });
}
