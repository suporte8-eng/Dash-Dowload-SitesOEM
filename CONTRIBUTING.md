# Como Contribuir com Novos Scripts

Se você deseja adicionar suporte para um novo site ou melhorar um script existente, siga os passos abaixo:

## Passo a Passo para Criar um Novo Script

1. **Crie o arquivo JavaScript**:
   Adicione um arquivo na pasta `scripts/` com o nome do site (ex: `meusite.js`).

2. **Siga o Modelo Padrão**:
   Seu script deve exportar um objeto com a seguinte estrutura (veja o arquivo `scripts/_template.js` para um exemplo completo):

   ```javascript
   export default {
     name: "Nome do Site",
     version: "1.0",
     author: "Seu Nome/Github",
     matchUrls: ["*://*.meusite.com/*"],
     description: "Breve descrição sobre o que o script baixa",
     configSchema: {
       delay: { type: "number", label: "Delay (ms)", default: 1000 }
     },
     run: async (config, signals, onProgress) => {
       // Lógica de download
       // Utilize signals.pause (verificando signals.isPaused) para pausar
       // Utilize signals.stop para abortar
       // Chame onProgress({ type: "PROGRESS", current, total, filename }) para notificar o dashboard
     }
   }
   ```

3. **Registre seu Script no `scripts/registry.json`**:
   Abra o arquivo `scripts/registry.json` e adicione uma nova entrada com as mesmas informações do seu script, definindo o caminho relativo sob a chave `"path"`. Exemplo:

   ```json
   {
     "id": "meusite",
     "name": "Nome do Site",
     "version": "1.0",
     "author": "Seu Nome/Github",
     "matchUrls": ["*://*.meusite.com/*"],
     "description": "Breve descrição sobre o que o script baixa",
     "configSchema": {
       "delay": { "type": "number", "label": "Delay (ms)", "default": 1000 }
     },
     "path": "scripts/meusite.js"
   }
   ```

4. **Teste Localmente**:
   - Abra o `dash/index.html` localmente.
   - Veja se o script aparece listado na barra lateral.
   - Abra a aba correspondente do site, ative a extensão e clique em **Iniciar** no Dashboard.

5. **Envie um Pull Request (PR)**:
   Submeta o seu PR no repositório. O Dashboard e a extensão carregarão seu script dinamicamente assim que a alteração for mesclada!
