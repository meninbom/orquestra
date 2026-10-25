# Orquestra 1.6.0 — plano detalhado de interação

## Objetivo e referências

Implementar os quatro pedidos do usuário sobre a versão 1.5.0, preservando compatibilidade, recursos e dados. Checkout inicialmente limpo, base `9f33021`. Implementador solicitado: OpenCode, modelo `openai/gpt-6-luna`, opção `variant=xhigh`.

As duas imagens fornecidas pelo usuário mostram o comportamento desejado do YouTube: player retangular com cantos arredondados dentro do canvas, seleção com alças e uma barra flutuante para o endereço. O vídeo pode ser reproduzido no próprio elemento. Não é suficiente abrir o modal existente. Referências locais:

- `C:/Users/Kauã/.t3/userdata/attachments/e55b50cc-9670-4daa-b814-691528ace0b2-a748d5dd-9ac6-4c2b-be3a-6e8f99fea6ca.png`
- `C:/Users/Kauã/.t3/userdata/attachments/e55b50cc-9670-4daa-b814-691528ace0b2-103d0d79-5f35-42bf-bb49-e7b3085574f1.png`

## 1. Todos os pontos de ligação ao selecionar uma ponta de seta

### Comportamento

- Selecionar uma seta mostra suas duas extremidades. Clicar numa extremidade entra no modo de conexão e mostra simultaneamente as quatro portas dos outros elementos elegíveis visíveis. Arrastar a extremidade também ativa esse modo imediatamente.
- Uma ponta ativa tem destaque próprio. Portas são legíveis em tema claro/escuro e mantêm tamanho/alvo de interação em pixels de tela ao mudar o zoom.
- Exibir portas de retângulos, elipses, agentes, notas, frames, imagens e cartões de mídia/link. Setas e traços não são destinos. Não exibir destinos ocultos; destinos bloqueados não podem ser alterados/vinculados, respeitando a política existente.
- Excluir a própria seta e o elemento ligado à outra ponta para evitar auto ligação involuntária. Identificar elementos de grupos sem confundir a porta do grupo com a porta de um membro.
- Hover/foco destaca a porta específica e mostra a prévia encaixada nela. Soltar sobre uma porta fixa exatamente aquele lado; não recalcular um lado diferente por proximidade ao centro.
- Permitir tanto arrastar/soltar quanto clicar na ponta e depois clicar na porta de destino. Soltar no vazio desconecta para uma extremidade livre; Escape cancela e restaura o estado anterior.
- Sair do modo ao mudar seleção/seção/projeto, apagar a seta, entrar em apresentação ou fechar o modo com Escape. Apenas escolher uma ponta não gera alteração no histórico.

### Implementação e aceite

- Concentrar estado transitório, elegibilidade, porta escolhida e geometria compartilhada em módulos focados. Rever `connectionTargetAt`, `reconnectArrowEndpoint`, preview, renderer e hit test.
- Concluir cada vínculo/reconexão/desconexão com um único passo undo. Manter IDs/portas na cópia, grupos, templates, biblioteca e exportações.
- Testar ponta de origem e destino, clique/clique e arraste, porta exata em dois zooms, cancelamento, livre, bloqueado/oculto, mover/redimensionar os nós e persistência.
- As portas auxiliares não aparecem em exportações, apresentação ou quando não há modo de conexão ativo. Capturas devem demonstrar todos os destinos elegíveis ao mesmo tempo.

## 2. YouTube embutido no canvas, conforme as imagens

### Comportamento

- URLs YouTube reconhecidas criam um elemento de vídeo inline, com dimensão inicial útil em 16:9 e cantos arredondados. Links antigos válidos ganham essa apresentação sem perder URL/título ou exigir reinserção. Páginas comuns mantêm a prévia atual.
- Estado de edição: clique seleciona e mostra contorno/alças e barra contextual com URL, editar endereço, abrir externamente e ativar player. Não iniciar vídeo ao importar, abrir projeto ou apenas selecionar.
- Estado de interação: duplo clique ou ação explícita ativa o iframe/player no próprio elemento. Controles nativos de reprodução, volume, legendas, progresso e fullscreen continuam utilizáveis. O vídeo não deve abrir obrigatoriamente em modal.
- A seleção e as alças ficam fora da área dos controles do YouTube; não cobrir o player ativo com overlays que escondam seus controles. Escape ou clique fora retorna à edição. Como eventos de iframe cross-origin não chegam ao pai, manter uma ação de sair da interação acessível fora do player.
- Arrastar e redimensionar pela moldura/alças funciona sem capturar cliques dos controles de vídeo. Ao desativar a interação ou trocar seção/projeto, pausar/desmontar o player; não deixar áudio oculto.
- A barra contextual acompanha posição/zoom, fica dentro do canvas quando possível e não é recortada pelo `foreignObject`. Editar URL valida HTTPS e mantém a identidade do item; se o link deixa de ser YouTube, apresentar o cartão correspondente.
- Preservar fallback **Abrir no navegador** para vídeos privados, bloqueados ou sem rede. O board continua abrindo offline; a reprodução web precisa de internet.

### Implementação e aceite

- Reutilizar normalização e isolamento existentes. Manter `Referer` do app somente no iframe YouTube direto da janela principal; não quebrar a identificação ao mover o iframe no DOM ou usar portal. Não passar preload/bridge a conteúdo remoto nem desabilitar web security.
- Atualizar o export estático para um cartão/representação útil do vídeo, sem depender de capturar iframe remoto ou carregar rede na exportação. Backup mantém URL e propriedades, não tenta baixar o vídeo.
- Evitar remontar o iframe durante pequenos rerenders de seleção e reprodução. Em transformações ativas, deixar a interação desabilitada para o gesto não ser consumido pelo player.
- Validar no Electron e pacote Windows: elemento inline antes/durante playback, barra, seleção e gesto de resize, URL editada, vídeo realmente avançando, header enviado, pausa ao sair e nenhum erro de runtime. Iframe existente/DOM sozinho não prova reprodução.

## 3. Redimensionar vários elementos selecionados

### Comportamento

- Seleção de dois ou mais elementos mostra uma caixa de transformação coletiva com alças de cantos e bordas e dimensões no painel Estilo. Não exigir agrupamento permanente.
- Cantos redimensionam proporcionalmente por padrão, ancorando o canto oposto; bordas alteram um eixo. Shift mantém proporção nas operações em que ela seria livre. Alt permite transformar a partir do centro, desde que consistente e testado.
- Calcular a transformação sempre a partir do snapshot inicial do gesto, evitando erro acumulado. Aplicar uma única transformação afim às posições/dimensões relativas e preservar a disposição da seleção.
- Impedir inversão/escala zero e limitar a transformação pelo tamanho mínimo dos membros. Não deixar NaN, espelhamento ou perda de itens ao atravessar a âncora.
- Em escala proporcional pelos cantos, escalar também tamanho de fonte/título do frame para manter proporção visual. Redimensionamento por um eixo mantém fonte e ajusta largura/quebra de texto. Reconciliar explicitamente com `autoHeight`, sem desfazer o tamanho escolhido no gesto seguinte.
- Imagens/vídeos/links mantêm suas regras de fit e o player fica sem interação durante resize. Traços escalam seus pontos locais. Grupos preservam identidade e posições relativas.
- Conectores entre nós selecionados acompanham as novas âncoras sem escala duplicada. Vínculos com nós externos continuam válidos; extremidades livres e traços selecionados recebem a transformação correta. Não desconectar silenciosamente uma seta existente.
- Se houver item bloqueado ou grupo parcialmente bloqueado, seguir uma política explícita: impedir a transformação coletiva e informar o motivo; não redimensionar apenas parte do grupo ocultamente. Itens ocultos não entram no bounding box.

### Implementação e aceite

- Extrair transformação e cálculo de limites para funções puras testáveis; compartilhar cálculos entre gesto e painel. Uma operação = um undo/redo, não uma entrada por frame.
- Testar seleção mista (forma/texto/mídia/traço/seta), grupos, texto automático, min-size, cantos/bordas, Shift, Alt, zoom/pan, cancelar, undo/redo e salvar/reabrir.
- Usar gestos CDP reais com handles e destinos visíveis, evitando barra de ferramentas e painel. A falha de um teste não pode ser resolvida reduzindo o critério funcional.

## 4. Mover/redimensionar nome, título e subtítulo da seção

### Modelo e interface

- Os três textos continuam sendo campos semânticos da seção: `name`, `description` e `subtitle`. Não convertê-los em itens comuns nem duplicar conteúdo na biblioteca.
- Adicionar layout opcional por campo à `Scene`, com posição X/Y, largura, tamanho de fonte e alinhamento quando necessário. Sem layout salvo, usar exatamente a posição/tipografia atuais; não deslocar quadros antigos.
- Selecionar cada campo no canvas, arrastar para mover e usar alça para redimensionar/largura; controles no painel Seções permitem X/Y, largura e tamanho da fonte. Oferecer **Restaurar posição e tamanho** por campo e para o conjunto.
- Distinguir gesto de seleção/movimento de duplo clique para editar o texto existente. Uma edição ou gesto não pode criar caixa de texto duplicada ou iniciar marquee acidentalmente.
- Escalar fonte por alça de canto; largura controla quebra. Suportar acentos e textos longos. Títulos não devem ser cortados ao crescer, e o indicador/número da seção deve continuar associado ao nome conforme o layout escolhido.
- Subtítulo vazio permanece vazio e não é substituído por texto padrão em seções novas. Permitir recuperá-lo pelo painel mesmo quando invisível no canvas.
- A transformação deve usar coordenadas de mundo, respeitar zoom/pan e permitir reposicionamento livre. Guias/controles são apenas auxiliares de edição.

### Persistência e exportações

- Validar campos opcionais finitos e limites razoáveis. Preservar layout em clone, template, importação/exportação, merge e versões persistentes; boards antigos continuam válidos.
- Compartilhar layout/métricas entre canvas e `StaticScene`; atualizar SVG, PNG e PDF para corresponderem ao resultado. Ajustar enquadramento/bounds para cabeçalhos fora do retângulo padrão, sem recortar conteúdo.
- Testar cada campo: seleção, movimento com zoom, resize, edição por duplo clique, painel, reset, undo/redo, reload, backup/template e exportações reais.

## Sequência e responsabilidades

1. Ler README, modelos, geometria/seleção, renderers, mídia/links, persistência, planos anteriores e testes. Inspecionar as imagens fornecidas. Registrar decisões técnicas antes de alterar os fluxos centrais.
2. Implementar funções de transformação e layout opcionais com testes significativos; manter a validação retrocompatível.
3. Integrar portas globais e redimensionamento coletivo, mantendo a seleção estável e a barra centralizada.
4. Implementar o player inline e o layout dos cabeçalhos; garantir paridade das exportações e backups.
5. Executar unidade/build e regressão Electron isolada; produzir capturas desktop e 800 × 600. Separar testes offline determinísticos do playback online.
6. Atualizar README, package/lock para 1.6.0 e este plano com checklist, evidências, testes e pendências honestas. Não declarar sucesso apenas porque existe um botão ou iframe.
7. O implementador não empacota, instala, faz commit/push ou usa o AppData real. Entrega ao agente principal para revisão.
8. O agente principal corrige achados, gera o instalador, compara ASAR/build, testa o executável empacotado e substitui a instalação Windows após fechamento normal. Preservar desinstalador, biblioteca, mídia e versões; comparar hashes antes/depois.
9. Validar a instalação em perfil temporário, reabrir o app real e realizar commit/push somente após os testes passarem, seguindo a orientação anterior da sessão.

## Critério final

Quatro fluxos utilizáveis no aplicativo instalado, sem regressão de PDFs, cores/fontes, grupos/bloqueios, camadas, estilos/modelos, versões, títulos de frames, mídia e links. Preservação dos dados confirmada, commit remoto verificado e árvore limpa na entrega final.

## Checklist de implementação e evidências — 25/10/2026

### Escopo da versão-fonte

- [x] Portas norte/leste/sul/oeste visíveis em conjunto ao escolher uma ponta; destinos ocultos/bloqueados/setas/traços excluídos; clique-a-clique e arraste usam o lado exato; Escape cancela; reconexão/desconexão têm um único undo/redo.
- [x] Player YouTube inline selecionável em proporção 16:9, barra de contexto fora do SVG, endereço HTTPS editável, abertura externa, ativação explícita, controles do iframe e saída externa/Escape/clique fora. Resize desmonta/pausa o iframe; links HTTPS comuns continuam usando o modal.
- [x] Resize coletivo por oito alças e painel, transformação de snapshot, proporção de canto, Shift/Alt, escala de texto, conectores, traços, mídia/grupos; bloqueio de seleção oculta/bloqueada e mensagem para seleção não transformável.
- [x] `name`, `description` e `subtitle` mantêm semântica; layout opcional com posição, largura, fonte/alinhamento, painel, movimento/resize, edição por duplo clique e reset; subtítulo vazio pode ser recuperado pelo painel. Canvas e exportação estática usam métricas/layout compartilhados.
- [x] Layout opcional validado, clonado em templates, incluído no backup/importação e compatível com boards legados sem `headingLayout`.
- [x] `package.json` e lockfile em `1.6.0`. O instalador `release/Orquestra-Setup-1.6.0-x64.exe` foi gerado depois da revisão; o assistente NSIS não foi executado e o AppData real não foi substituído.

### Correções da revisão do agente principal

- [x] Exportações SVG/PNG/PDF removem todos os auxiliares de edição com um único removedor compartilhado (`src/svgExport.ts`): seleção, alças, guias, portas/destinos de conexão, prévia de conector, pontas e seleção/alça de cabeçalho. O conteúdo real (itens, setas, imagem embutida e textos semânticos) permanece.
- [x] Limites de conteúdo compartilhados por `src/sceneBounds.ts` entre SVG/PNG ao vivo, SVG estático/PDF e **Enquadrar seção**: itens visíveis (`itemBounds`), títulos com quebra real de linha, sublinhado do nome e ornamento/underline do subtítulo. Moldura legada padrão preservada (`{x:0,y:-10,w:1140,h:835}`, mínimo 1140×825, padding 30 px).
- [x] Redimensionamento coletivo sem espelhamento: escala assinada por eixo, clamp na âncora ao cruzar, mínimo por eixo, cantos/Shift com âncora oposta, Alt pelo centro, política única de 20 px no gesto e nos campos do painel.
- [x] `autoHeight` reconciliado explicitamente: redimensionamento horizontal recalcula a altura pelo texto (medição injetada); vertical/proporcional desliga `autoHeight` para não desfazer o tamanho escolhido.
- [x] Fluxos de aceitação reais cobrem seleção coletiva ativa, cabeçalho selecionado e modo de ponta antes das exportações; o fixture é enquadrado pela UI (`Enquadrar seção`) e o clique usa um glifo realmente atingível, não uma fração cega da caixa.
- [x] O fluxo de Link Preview restaura a aba **Seções** antes de criar uma seção, sem depender do estado deixado pelo fluxo anterior.

### Testes executados

- `npm test`: **60/60** casos aprovados, incluindo contratos de âncoras cruzadas, mínimo por eixo, Shift/Alt, `autoHeight`, limites compartilhados com títulos quebrados/fora do canvas e moldura legada.
- `npm run build`: aprovado; aviso existente de bundle JavaScript acima de 500 kB.
- `ORQUESTRA_TEST_SOURCE=1; node scripts/test-packaged.mjs`: fluxo Electron/CDP completo com perfil temporário aprovado após as correções: 800 × 600, features, conexões/frames, PDF, exportações com sobreposições ativas e Link Preview comum; `runtimeErrors: []`.
- `ORQUESTRA_TEST_SOURCE=1; ORQUESTRA_TEST_PDF_ONLY=1; node scripts/test-packaged.mjs`: aprovado novamente após o ajuste de `fit()`; conexões em zoom 48%/207%, click-to-click com porta exata/undo, movimentação, resize, undo/redo, SVG/PDF real, PDF local e erros de runtime vazios.
- `ORQUESTRA_TEST_SOURCE=1; ORQUESTRA_TEST_LINK_ONLY=1; node scripts/test-packaged.mjs`: aprovado em isolamento; confirma que a restauração da aba Seções não altera contagem de projetos, prévia comum, foco/fullscreen nem o player YouTube condicional.
- `ORQUESTRA_TEST_SOURCE=1; ORQUESTRA_TEST_LINK_ONLY=1; ORQUESTRA_TEST_YOUTUBE_PLAYBACK=1; node scripts/test-packaged.mjs`: evidência separada de reprodução real. O teste consulta o `<video>` do frame Electron e só aceita tempo avançando pelo menos 0,5 s; evidência registrada com `readyState=4`, `paused=false`, duração de 213,061 s e avanço observado. A requisição do iframe direto foi vista com `Referer: https://app.orquestra.whiteboard/`.
- Regressão final após o ajuste de largura da barra contextual: `$env:ORQUESTRA_TEST_SOURCE='1'; $env:ORQUESTRA_TEST_YOUTUBE_PLAYBACK='1'; node scripts/test-packaged.mjs` passou com todos os fluxos Electron/CDP, inclusive o playback real. Avanço observado de 0,703776 s para 1,714165 s (`+1,010389 s`), duração 213,061 s, `readyState=4`, `paused=false`, sem erro; a requisição do iframe direto incluiu `Referer: https://app.orquestra.whiteboard/`. Os relatórios e capturas em `.qa/` foram atualizados; erros de runtime: nenhum.
- Relatórios e capturas em `.qa/`: `packaged-smoke.json`, `pdf-connections-frames-flow.json`, `link-preview-flow.json`, `board-800x600.png`, `connector-all-ports-click-mode.png`, `selection-resize-multiple.png`, `section-heading-layout.png`, `youtube-inline-*.png`, e as exportações reais desta rodada: `export-active-collective.svg`, `export-active-collective.png`, `export-active-endpoint.svg` e `export-expanded-board.pdf`.
- A exportação SVG real confirma ausência de todos os auxiliares e presença da imagem `data:image/png;base64`; o PNG real foi decodificado manualmente (zlib) e teve **327.600** pixels amostrados pintados, provando conteúdo renderizado além do fundo. O PDF real contém a moldura SVG completa do canvas vivo, o vetor do sublinhado do subtítulo fora do canvas, o operador `paintImageXObject` da imagem e o nome da seção em DM Sans fora do retângulo legado.

### Limites e entrega

- A validação da implementação foi feita na versão-fonte. Depois, `node scripts/test-packaged.mjs` passou no executável `release/win-unpacked/Orquestra.exe` da 1.6.0, com perfil temporário e sem playback real do YouTube.
- A extração de texto do PDF é parcial para as fontes de manuscrito/subconjunto: o teste verifica o nome completo em DM Sans, os inícios `Títu`/`Sub` em Caveat, a moldura vetorial e a imagem, não todas as palavras do título/subtítulo. SVG e PNG preservam essas strings por inteiro.
- `dist:win` gerou `release/Orquestra-Setup-1.6.0-x64.exe`. A publicação automática do electron-builder não ocorreu porque não há `GH_TOKEN`. A substituição da instalação em `%APPDATA%` e o push continuam fora desta etapa.
