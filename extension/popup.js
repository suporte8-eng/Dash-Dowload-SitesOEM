// popup.js

const selectScript = document.getElementById("script-select");
const scriptDesc = document.getElementById("script-desc");
const dynamicConfig = document.getElementById("dynamic-config");
const configFields = document.getElementById("config-fields");
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnStop = document.getElementById("btn-stop");
const btnClearLog = document.getElementById("btn-clear-log");
const logBox = document.getElementById("log-box");
const openDash = document.getElementById("open-dash");

let scripts = {};
let appState = "idle"; // idle | running | paused

// Solicita scripts ao background
async function loadScripts() {
  chrome.runtime.sendMessage({ type: "GET_SCRIPTS" }, (response) => {
    if (chrome.runtime.lastError) {
      addLog("Erro ao carregar scripts do Background. Recarregue a extensão.", "error");
      return;
    }
    if (response && response.scripts) {
      scripts = response.scripts;
      populateSelect();
    }
  });
}

function populateSelect() {
  selectScript.innerHTML = '<option value="">-- Selecione um Script --</option>';
  for (const id in scripts) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${scripts[id].name} (v${scripts[id].version})`;
    selectScript.appendChild(opt);
  }
}

// Renderiza schema de configuração dinamicamente
function renderConfigSchema(scriptId) {
  configFields.innerHTML = "";
  if (!scriptId || !scripts[scriptId]) {
    scriptDesc.style.display = "none";
    dynamicConfig.style.display = "none";
    return;
  }

  const script = scripts[scriptId];
  scriptDesc.textContent = script.description || "Sem descrição.";
  scriptDesc.style.display = "block";

  const schema = script.configSchema || {};
  const keys = Object.keys(schema);

  if (keys.length === 0) {
    dynamicConfig.style.display = "none";
    return;
  }

  dynamicConfig.style.display = "block";

  // Carregar valores salvos anteriormente do storage
  chrome.storage.local.get(`config_${scriptId}`, (data) => {
    const savedConfig = data[`config_${scriptId}`] || {};

    for (const key of keys) {
      const field = schema[key];
      const formGroup = document.createElement("div");
      formGroup.style.marginBottom = "10px";

      const label = document.createElement("label");
      label.textContent = field.label || key;
      label.style.fontSize = "0.75rem";
      label.style.display = "block";
      label.style.marginBottom = "4px";

      let input;
      if (field.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = savedConfig[key] !== undefined ? savedConfig[key] : (field.default || 0);
      } else if (field.type === "boolean") {
        input = document.createElement("select");
        input.innerHTML = `
          <option value="true">Sim</option>
          <option value="false">Não</option>
        `;
        input.value = savedConfig[key] !== undefined ? String(savedConfig[key]) : String(field.default);
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = savedConfig[key] !== undefined ? savedConfig[key] : (field.default || "");
      }

      input.dataset.key = key;
      input.dataset.type = field.type;
      input.className = "config-input";
      
      // Auto-salvar no storage ao alterar
      input.addEventListener("change", () => saveConfig(scriptId));

      formGroup.appendChild(label);
      formGroup.appendChild(input);
      configFields.appendChild(formGroup);
    }
  });
}

function saveConfig(scriptId) {
  const inputs = configFields.querySelectorAll(".config-input");
  const config = {};
  inputs.forEach(input => {
    const key = input.dataset.key;
    const type = input.dataset.type;
    let val = input.value;
    if (type === "number") val = Number(val);
    if (type === "boolean") val = val === "true";
    config[key] = val;
  });
  chrome.storage.local.set({ [`config_${scriptId}`]: config });
}

function getSelectedConfig() {
  const inputs = configFields.querySelectorAll(".config-input");
  const config = {};
  inputs.forEach(input => {
    const key = input.dataset.key;
    const type = input.dataset.type;
    let val = input.value;
    if (type === "number") val = Number(val);
    if (type === "boolean") val = val === "true";
    config[key] = val;
  });
  return config;
}

// Logs
function addLog(message, type = "status") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}

// Gerenciamento de UI baseado no Estado
function updateStateUI(state) {
  appState = state;
  if (state === "running") {
    btnStart.disabled = true;
    btnPause.disabled = false;
    btnPause.textContent = "Pausar";
    btnStop.disabled = false;
    selectScript.disabled = true;
  } else if (state === "paused") {
    btnStart.disabled = false;
    btnStart.textContent = "Retomar";
    btnPause.disabled = true;
    btnStop.disabled = false;
    selectScript.disabled = true;
  } else { // idle
    btnStart.disabled = false;
    btnStart.textContent = "Iniciar";
    btnPause.disabled = true;
    btnPause.textContent = "Pausar";
    btnStop.disabled = true;
    selectScript.disabled = false;
  }
}

// Event Listeners
selectScript.addEventListener("change", (e) => {
  renderConfigSchema(e.target.value);
});

btnStart.addEventListener("click", async () => {
  const scriptId = selectScript.value;
  if (!scriptId) {
    addLog("Selecione um script antes de iniciar.", "error");
    return;
  }

  if (appState === "paused") {
    chrome.runtime.sendMessage({ type: "RESUME_SCRIPT" });
    updateStateUI("running");
    addLog("Execução retomada.", "status");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    addLog("Nenhuma aba ativa encontrada.", "error");
    return;
  }

  const config = getSelectedConfig();
  
  updateStateUI("running");
  addLog(`Iniciando ${scripts[scriptId].name} na aba ${tab.title || tab.id}...`, "status");

  chrome.runtime.sendMessage({
    type: "RUN_SCRIPT",
    scriptId,
    config,
    tabId: tab.id
  });
});

btnPause.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "PAUSE_SCRIPT" });
  updateStateUI("paused");
  addLog("Solicitando pausa...", "status");
});

btnStop.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_SCRIPT" });
  updateStateUI("idle");
  addLog("Execução cancelada pelo usuário.", "error");
});

btnClearLog.addEventListener("click", () => {
  logBox.innerHTML = "";
});

openDash.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("dash/index.html") });
});

// Ouvir mensagens do background worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PROGRESS") {
    addLog(`${message.current}/${message.total} — ${message.filename} ✓`, "success");
  } else if (message.type === "STATUS") {
    addLog(message.message, "status");
  } else if (message.type === "ERROR") {
    addLog(message.message, "error");
  } else if (message.type === "STATE_CHANGE") {
    updateStateUI(message.state);
  }
});

// Inicialização
loadScripts();
chrome.runtime.sendMessage({ type: "GET_CURRENT_STATE" }, (response) => {
  if (response && response.state) {
    updateStateUI(response.state);
  }
});
