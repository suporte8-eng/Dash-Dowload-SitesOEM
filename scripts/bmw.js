export default {
  name: "BMW TIS",
  version: "1.0",
  author: "Comunidade",
  matchUrls: ["*://tis.bmw.de/*", "*://*.bmw.de/*", "*://*.bmw.com/*", "*://tisv2.bmw.com/*"],
  description: "Baixa documentos técnicos e diagramas do portal BMW TIS",

  configSchema: {
    delay: { type: "number", label: "Delay entre downloads (ms)", default: 800 }
  },

  run: async (config, signals, onProgress) => {
    const { delay } = config;

    const links = [
      ...document.querySelectorAll("a[href*='showDoc.do']"),
      ...document.querySelectorAll("a[href*='/tisv2/']")
    ];

    const total = links.length;
    if (total === 0) {
      onProgress({ type: "STATUS", message: "Nenhum link encontrado na página." });
      return { total: 0, success: 0, errors: 0 };
    }

    onProgress({ type: "STATUS", message: `Encontrados ${total} links. Iniciando downloads...` });

    let success = 0;
    let errors = 0;

    for (let i = 0; i < total; i++) {
      if (signals.stop.signal.aborted) {
        onProgress({ type: "STATUS", message: "Execução interrompida pelo usuário." });
        return { total, success, errors: errors + (total - i) };
      }

      await signals.pause();

      const link = links[i];
      const nome = (link.innerText || `documento_${i + 1}`)
        .replace(/[\\/:*?"<>|]/g, "").trim();

      onProgress({ type: "PROGRESS", current: i + 1, total, filename: nome });

      try {
        const url = new URL(link.getAttribute("href"), location.origin).href;
        const r = await fetch(url, { credentials: "include" });
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const frame = doc.querySelector("object[data], iframe[src], embed[src], embed[data]");
        if (frame) {
          const frameURL = new URL(
            frame.getAttribute("data") || frame.getAttribute("src"),
            url
          ).href;
          let svgURL = null;

          if (frameURL.toLowerCase().includes(".svg")) {
            svgURL = frameURL;
          } else {
            const fr = await fetch(frameURL, { credentials: "include" });
            const frameHTML = await fr.text();
            const match = frameHTML.match(/https?:\/\/[^"' ]+\.svg/i);
            if (match) svgURL = match[0];
          }

          if (svgURL) {
            const rsvg = await fetch(svgURL, { credentials: "include" });
            const svgText = await rsvg.text();
            const base64 = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgText)));
            const img = document.createElement("img");
            img.src = base64;
            frame.replaceWith(img);
          }
        }

        const imgs = [...doc.querySelectorAll("img[src]")];
        for (const img of imgs) {
          if (signals.stop.signal.aborted) break;
          try {
            const src = new URL(img.getAttribute("src"), url).href;
            const ir = await fetch(src, { credentials: "include" });
            const blob = await ir.blob();
            const base64 = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            const imgEl = document.createElement("img");
            imgEl.src = base64;
            img.replaceWith(imgEl);
          } catch (err) {
            onProgress({ type: "ERROR", message: `Erro ao baixar imagem em ${nome}: ${err.message}` });
          }
        }

        success++;
        await new Promise(r => setTimeout(r, delay));
      } catch (err) {
        errors++;
        onProgress({ type: "ERROR", message: `Erro ao processar ${nome}: ${err.message}` });
      }
    }

    onProgress({ type: "STATUS", message: `Concluído! ${success} sucessos, ${errors} erros.` });
    return { total, success, errors };
  }
};
