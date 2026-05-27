# AutoDownload Dash

AutoDownload Dash é uma plataforma flexível para gerenciar e executar scripts de automação de downloads e extração de dados diretamente do seu navegador. O projeto consiste em uma Extensão do Chrome (Manifest V3) que se conecta a um Dashboard Web (SPA).

A grande vantagem desta arquitetura é que ela é **100% dinâmica**: os scripts são carregados diretamente do repositório por meio do arquivo `scripts/registry.json`. Desta forma, qualquer pessoa pode submeter suporte a novos sites enviando uma PR simples sem alterar o núcleo da extensão!

## Estrutura do Projeto

*   `scripts/`: Contém os scripts de automação e o arquivo `registry.json`.
*   `extension/`: Arquivos da extensão do Google Chrome.
*   `dash/`: O painel de controle web (SPA).

## Instalação da Extensão (Modo Desenvolvedor)

1.  Abra o Google Chrome e acesse `chrome://extensions/`.
2.  Ative a opção **Modo do desenvolvedor** no canto superior direito.
3.  Clique em **Carregar sem compactação** (Load unpacked).
4.  Selecione a pasta `extension` deste projeto.

## Como Contribuir com Novos Scripts

Para adicionar suporte para um novo site:
1. Crie seu script sob a pasta `scripts/`.
2. Registre-o no arquivo `scripts/registry.json`.

Consulte o [CONTRIBUTING.md](file:///c:/Dash%20Dowload%20SitesOEM/CONTRIBUTING.md) para ver o guia de desenvolvimento de novos scripts passo a passo.

## Como Usar o Dashboard

1.  Abra a página do Dashboard localizado na pasta `dash/index.html` (ou acesse a URL se estiver publicada via GitHub Pages).
2.  Selecione a automação desejada na barra lateral (os scripts e configurações são carregados dinamicamente do registry).
3.  Configure os campos personalizados apresentados.
4.  Certifique-se de que está na aba correta no navegador e utilize os botões **Iniciar**, **Pausar** e **Parar** para gerenciar a execução.
