export default {
  name: "Script Template",
  version: "1.0",
  author: "Seu Nome",
  matchUrls: ["*://exemplo.com/*"],
  description: "Template base para criação de novas automações de download.",

  configSchema: {
    delay: { type: "number", label: "Delay entre downloads (ms)", default: 1000 },
    downloadImages: { type: "boolean", label: "Baixar imagens", default: true }
  },

  run: async (config, signals, onProgress) => {
    const { delay } = config;

    const links = document.querySelectorAll("a[href*='download'], a[href*='doc']");
    const total = links.length;

    if (total === 0) {
      onProgress({ type: "STATUS", message: "Nenhum link encontrado na página." });
      return { total: 0, success: 0, errors: 0 };
    }

    onProgress({ type: "STATUS", message: `Encontrados ${total} links. Iniciando...` });

    for (let i = 0; i < total; i++) {
      if (signals.stop.signal.aborted) {
        onProgress({ type: "STATUS", message: "Execução interrompida pelo usuário." });
        return { total, success: i, errors: total - i };
      }

      await signals.pause();

      const link = links[i];
      const filename = (link.innerText || link.title || `documento_${i + 1}`).trim().replace(/[\\/:*?"<>|]/g, "") || `arquivo_${i + 1}`;

      onProgress({ type: "PROGRESS", current: i + 1, total, filename });

      try {
        link.click();
        await new Promise(r => setTimeout(r, delay));
      } catch (err) {
        onProgress({ type: "ERROR", message: `Erro no item ${i + 1}: ${err.message}` });
      }
    }

    onProgress({ type: "STATUS", message: "Download concluído!" });
    return { total, success: total, errors: 0 };
  }
};
