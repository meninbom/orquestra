# Orquestra 1.5.0 — seleção, PDFs, conexões e frames

## Escopo aprovado

Corrigir a barra de seleção descentralizada e implementar visualização completa de PDFs, conexões mais fluidas entre elementos e títulos de frames. Preservar todas as funcionalidades da versão 1.4.0 e as alterações locais ainda não commitadas. Sem sincronização ou serviços externos.

## 1. Barra de seleção

- Centralizar em relação à área real do canvas, usando a mesma referência dos controles de seção. Eliminar a compensação fixa de 250 px.
- Acompanhar abrir/fechar o painel lateral, redimensionar janela e viewport de 800 × 600; sem sobrepor os controles inferiores nem ficar fora da tela.
- Verificar centros geométricos com tolerância de 2 px e inspecionar capturas com uma e várias seleções, painel aberto/fechado.

## 2. Visualização de PDF

- PDFs importados continuam sendo anexos locais transportáveis no backup. Oferecer ação clara de visualizar no cartão e abertura por duplo clique.
- Leitor amplo em modal, com título/nome, fechar/Escape, página atual/total, anterior/próxima, zoom, ajustar à largura/página, rolagem de todas as páginas e opção de tela cheia. Permitir baixar o original.
- Renderização local/offline no navegador e Electron, inclusive no aplicativo empacotado. Preferir PDF.js com worker local e licença; não depender de plugin de PDF ou de servidor externo. Conferir documentação oficial para a integração quando necessário.
- Carregar páginas progressivamente e limitar escala/memória; cancelar tarefas e liberar URLs ao trocar/fechar. Tratar carregamento, arquivo inválido/corrompido, mídia ausente e PDF protegido com mensagem útil.
- Links internos/externos não podem executar conteúdo ou navegar a aplicação; links externos apenas HTTPS via caminho seguro existente. Conteúdo ativo do PDF não é executado.
- Testar PDF local de várias páginas com acentos e conteúdo visual, navegação/zoom/rolagem/tela cheia/fechamento, reabertura após reload, original intacto e ausência de erros de runtime. Preview não deve mudar a edição nem a apresentação.

## 3. UX de conexões

- Mostrar pontos de conexão em elementos selecionados/sob interação apropriada, com alvos fáceis de acertar em diferentes zooms. Evitar poluir o canvas inteiro.
- Arrastar de um ponto inicia conector com prévia; destacar alvo e porta de destino antes de soltar; encaixe por tolerância em pixels de tela. Soltar no vazio cria seta livre e Escape cancela sem item residual.
- Ferramenta Seta existente continua funcionando. Endpoints conectados chegam ao contorno da forma, escolhendo lado de maneira previsível; incluir elipses. Sem conectores atravessando o centro dos blocos.
- Permitir selecionar e arrastar as extremidades para reconectar/desconectar. Conexões acompanham movimento/redimensionamento, grupos, duplicação, templates, backup e undo/redo.
- Evitar auto ligação involuntária e referências inválidas. Respeitar ocultação e bloqueio, inclusive setas bloqueadas. Preserve sentido/curva/estilo/animações e compatibilidade com dados antigos sem novos campos.
- Compartilhar geometria entre canvas, hit test e exportações SVG/PNG/PDF. Novos campos opcionais validados e IDs remapeados corretamente.
- Testar gestos reais em dois zooms, iniciar/conectar/cancelar/reconectar/desconectar, mover/redimensionar origem e alvo, undo/redo, cópia/importação e bloqueios; conferir visualmente o feedback.

## 4. Títulos de frames

- Campo explícito "Título do frame" no painel Estilo e edição por duplo clique no título visível. Frame novo tem título inicial útil; título pode ser vazio para ocultar.
- Reaproveitar `Item.text` quando compatível, distinguindo o título do nome organizacional da camada. Manter frames antigos visualmente compatíveis, sem texto central indesejado.
- Título no topo da moldura, legível com fundo/recorte da borda quando necessário, sem impedir selecionar elementos contidos. Considerar largura, textos longos e área de hit test.
- Aplicar fonte/cor/formatação disponíveis, respeitar bloqueio/ocultação, salvar/recarregar, undo/redo, clones, modelos e exportações.
- Testar criar/editar/apagar título, editar pelo canvas/painel, persistência e exportação real.

## Sequência e validação

1. [x] Revisar modelo, mídia, seleção/geometria, exportação e testes existentes. Registrar escolhas técnicas.
2. [x] Corrigir posição da seleção; implementar títulos e geometria/gestos de conexão em módulos focados.
3. [x] Integrar leitor de PDF offline e embalagem de recursos/worker/standalone; atualizar licenças se aplicável.
4. [x] Testes unitários de regras/geometria/validação relevantes e fluxos Electron reais com perfis temporários. Nunca usar a biblioteca real em testes.
5. [x] `npm test`, `npm run build`, smoke desktop e regressões de funcionalidades/customização, capturas desktop/800 × 600 e exportações.
6. [x] Atualizar README, este registro de execução e versão 1.5.0 em package/lock. Não fazer commit/push sem novo pedido.
7. [x] Agente principal revisa a entrega, gera `npm run dist:win`, testa o executável empacotado, fecha normalmente o app instalado e substitui `%LOCALAPPDATA%/Programs/Orquestra`, preservando desinstalador e dados.
8. [x] Conferir hashes de executável/asar e biblioteca antes/depois da substituição; testar instalação com perfil isolado e reabrir app real.

## Registro de execução 1.5.0 — 2026-10-25

### Entregas implementadas

- A barra de seleção e os controles de seção usam o centro da área real do canvas. A verificação em 800 × 600 mediu diferença inferior a 0,001 px nos quatro cenários (seleção única/múltipla, painel aberto/fechado); a barra fica acima dos controles e dentro da área visível.
- O leitor usa `pdfjs-dist` 6.4.299 com worker, fontes, CMaps, decoders e licenças locais. `npm run build` prepara `dist/pdfjs/`, que é carregado ao lado de `dist/orquestra.html` e incluído pelo `electron-builder`. O viewer faz renderização progressiva, libera tarefas ao fechar, limita a escala, desativa anotações/links, informa erros e oferece navegação, ajuste, zoom, tela cheia e download do original.
- Conectores usam portas cardinais opcionais em dados legados, geometria Bézier compartilhada entre canvas, interação/hit test e exportação estática, pontos elípticos e âncoras no contorno. O fluxo real cobriu prévia/alvo em 48%, Escape, soltar para conectar, reconectar e desconectar em 207%, movimento e redimensionamento de origem/alvo, undo/redo; testes de modelo cobrem bloqueio/ocultação, IDs e cópia/modelos.
- Frames novos recebem “Novo frame”. `Item.text` guarda título editável no painel e por duplo clique, vazio oculta o rótulo e o título aparece no topo da moldura nas cenas e exportações sem capturar o interior.

### Verificações executadas

- `npm test`: 54 testes aprovados, 0 falhas.
- `npm run build`: TypeScript, Vite e standalone concluídos; standalone gerado em `dist/orquestra.html` (aprox. 1.303 kB), com recursos PDF em `dist/pdfjs/`.
- `ORQUESTRA_TEST_SOURCE=1 node scripts/test-packaged.mjs`: regressão de interface Electron aprovada com perfil temporário isolado, incluindo biblioteca/projetos, mídia existente e todas as quatro entregas deste plano.
- O fluxo gera um PDF local real de três páginas com acentos e anotação externa inativa. Confirmou worker local, renderização progressiva, navegação e rolagem, ajuste/zoom, tela cheia/Escape, abertura por duplo clique, reabertura após recarga, bytes originais preservados e zero erros de runtime. Também exportou SVG e PDF do board; o SVG foi inspecionado por seus títulos e marcador de seta, e o PDF foi reaberto pelo PDF.js de teste para validar páginas e título renderizado.
- Medidas numéricas e capturas em `.qa/`: `selection-bar-800x600-{open,closed}-{single,multiple}.png`, `frame-title-800x600.png`, `connector-preview-50-percent.png`, `pdf-viewer-page-3.png`, `pdf-viewer-fullscreen.png`, `acceptance-section.svg`, `acceptance-board.pdf` e `pdf-connections-frames-flow.json`.

### Limites desta rodada

- Não foi executado `npm run dist:win`, nem testado/instalado o executável empacotado 1.5.0; os passos 7 e 8 aguardam a revisão e execução do agente principal. Nenhum dado de biblioteca real foi usado e nenhuma alteração foi instalada.
- O build mantém o aviso do Vite de que o bundle JavaScript minificado excede 500 kB. O fluxo UI usou arquivo PDF válido de três páginas; arquivo ausente/corrompido e PDF protegido por senha têm tratamento implementado, mas esses estados não foram exercitados no fluxo visual desta rodada.
- O export do board Electron foi validado no perfil de teste isolado; escolha do destino do diálogo do navegador continua manual. Nenhum commit, push ou pacote foi criado.

## Critério de conclusão

As quatro entregas devem ser funcionais, persistentes quando aplicável e testadas no executável final. Registrar exatamente o que foi testado e quaisquer limites reais. Botões ou componentes sem fluxo completo não constituem entrega.

## Revisão principal e integração de links

O usuário acrescentou prévia de páginas HTML/YouTube e autorizou commit/push após os testes. O módulo de links foi integrado ao cartão (botão e duplo clique), com modal ampliável, isolamento de atalhos, fallback para navegador e reprodução após ação explícita. O helper desktop fornece a identificação registrada do aplicativo somente ao iframe YouTube direto.

- A revisão principal confirmou os 55 testes unitários e o build. O teste de gravação simula bloqueios Windows temporários e persistentes; a biblioteca anterior permanece disponível enquanto a renomeação atômica é repetida com limite.
- `node scripts/test-desktop.mjs` passou após corrigir a expectativa do teste para o novo diretório `exports` do perfil isolado. O PDF real tem três páginas; o fechamento preserva a última edição.
- O fluxo de aceitação source passou com PDF ausente, corrompido, senha incorreta e senha correta, mantendo o original. Ao recarregar, o teste retorna explicitamente à seção que contém o documento.
- A prévia de links source passou com página HTTPS interceptada localmente, fallback externo interceptado, teclado/foco/expansão, persistência do URL e reprodução real do YouTube (`readyState=4`, vídeo despausado e tempo avançando), sem erros de runtime.
- Corrigida a ampliação de links quando a solicitação nativa de fullscreen permanece pendente: a expansão CSS ocorre imediatamente. O limite de pixels do PDF também vale para páginas de dimensões excepcionalmente grandes.

O pacote final deve ser reconstruído depois dessas correções e submetido à regressão completa antes da substituição da instalação e publicação Git, conforme a autorização do usuário.

### Aceite final Windows 1.5.0

- Pacote final reconstruído e conteúdo do ASAR comparado byte a byte com os arquivos de build/serviços relevantes.
- Regressão completa aprovada em `release/win-unpacked/Orquestra.exe` e novamente em `%LOCALAPPDATA%/Programs/Orquestra/Orquestra.exe`, com `ORQUESTRA_TEST_YOUTUBE_PLAYBACK=1`: todos os recursos novos e anteriores, PDFs ausentes/corrompidos/protegidos, exportações e reprodução real do YouTube, sem erros de runtime.
- Smoke de customização aprovado no pacote e na instalação: 20 fontes, edição de texto, formas com Shift, cores independentes, símbolos e aparência persistente.
- Os SHA256 do executável e `resources/app.asar` instalados correspondem ao build. A biblioteca real permaneceu igual durante substituição e testes isolados; aplicativo reaberto no perfil real após o aceite.
- Evidências locais: `.qa/release-1.5.0-smoke.json`, `.qa/installed-1.5.0-smoke.json`, `.qa/installation-1.5.0.json` e `.qa/customization-smoke.json`. Instalador e manifesto SHA256 em `release/`.
- A preparação dos gestos de teste agora considera o painel e a barra de ferramentas no zoom alto; a exportação PDF tem limite de espera próprio de 30 segundos e diagnóstico explícito. Os critérios funcionais das verificações foram mantidos.
