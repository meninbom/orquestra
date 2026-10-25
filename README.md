# Orquestra

Whiteboard local para desenhar e apresentar explicações sobre orquestração de agentes. React, TypeScript, Vite e aplicativo Windows com Electron, sem backend ou chaves de API. O código-fonte está na versão **1.6.0**.

## Windows

O instalador Windows desta versão está em `release/Orquestra-Setup-1.6.0-x64.exe`. A instalação é por usuário, cria atalhos na Área de Trabalho e no menu Iniciar e não requer servidor Vite. O executável empacotado fica em `release/win-unpacked/Orquestra.exe`; mantenha a pasta inteira caso use essa versão. O assistente NSIS não foi executado nesta entrega, então a biblioteca em `%APPDATA%\Orquestra` permanece como estava.

A biblioteca é gravada em `%APPDATA%\Orquestra\biblioteca.json`, com a versão anterior em `biblioteca.json.bak`. Em **Projetos → Abrir pasta de dados** é possível localizar os arquivos. As gravações são serializadas e usam um arquivo temporário antes da substituição; o fechamento normal aguarda a gravação da última edição. A desinstalação preserva os dados. O instalador desta versão não tem assinatura digital.

A versão 1.6.0 foi validada no executável empacotado `release/win-unpacked/Orquestra.exe`, com perfil temporário: regressão completa, player YouTube inline, leitor PDF e seus estados de erro, exportações sem auxiliares de edição, conexões, frames e recursos anteriores. A reprodução real do YouTube (`ORQUESTRA_TEST_YOUTUBE_PLAYBACK=1`) foi confirmada na versão-fonte em Electron, não repetida neste executável.

Para levar projetos do navegador ao Windows, use **Projetos → Backup da biblioteca** no navegador e **Projetos → Importar projetos** no aplicativo. Também é possível importar os antigos arquivos de quadro JSON.

```powershell
npm run desktop     # compila e abre o app
npm run dist:win    # gera instalador Windows x64
npm test           # testes de modelos, geometria, grupos, estilos, mídia, versões e seleção
node scripts/test-desktop.mjs  # fluxo Electron com perfil temporário isolado
$env:ORQUESTRA_TEST_SOURCE="1"; node scripts/test-packaged.mjs # regressão UI no Electron de desenvolvimento, perfil temporário
node scripts/test-packaged.mjs # fluxo completo no executável empacotado, perfil isolado
$env:ORQUESTRA_TEST_EXE="release/win-unpacked/Orquestra.exe"; node scripts/test-packaged.mjs # escolha explícita do executável empacotado ou instalado
$env:ORQUESTRA_TEST_SOURCE="1"; $env:ORQUESTRA_TEST_LINK_ONLY="1"; node scripts/test-packaged.mjs # somente Link Preview, sem criar projeto
$env:ORQUESTRA_TEST_EXE="release/win-unpacked/Orquestra.exe"; $env:ORQUESTRA_TEST_LINK_ONLY="1"; node scripts/test-packaged.mjs # somente Link Preview no executável escolhido
$env:ORQUESTRA_TEST_YOUTUBE_PLAYBACK="1"; node scripts/test-packaged.mjs # exige rede e confirma playback real no YouTube
$env:ORQUESTRA_TEST_SOURCE="1"; node scripts/test-customization.mjs # fluxo de preservação da UI no Electron de desenvolvimento
$env:ORQUESTRA_TEST_SOURCE="1"; node scripts/test-packaged.mjs # regressão de UI Electron + PDF/conexões/frames, perfil temporário
$env:ORQUESTRA_TEST_SOURCE="1"; $env:ORQUESTRA_TEST_PDF_ONLY="1"; node scripts/test-packaged.mjs # aceitação PDF/conexões/frames, perfil temporário
```

## Projetos

O botão **Projetos** abre a biblioteca. Crie um projeto vazio ou use o exemplo de orquestração; pesquise, abra, duplique ou exclua projetos. A exclusão pede confirmação. Ao excluir o último projeto, um projeto vazio é criado para manter o editor utilizável.

Selecione dois ou mais projetos e use **Mesclar** para criar um novo projeto com todas as suas seções, na ordem da biblioteca. Os originais permanecem intactos; conectores, etapas e animações são preservados. O resultado aceita até 200 seções.

O salvamento é automático. **Ctrl+S** e o botão de disquete salvam imediatamente; **Ctrl+Shift+P** abre a biblioteca. No navegador, os dados ficam em `orquestra-library-v1` no armazenamento local. O quadro da versão anterior é migrado automaticamente quando ainda não existe uma biblioteca, e a chave antiga é mantida. Backups e importações acrescentam projetos e não substituem os existentes. O histórico de desfazer é separado entre sessões de edição de projetos e não atravessa uma troca de projeto.

## Executar

```powershell
npm install
npm run dev -- --port 5281 --strictPort
```

Abra http://localhost:5281. Para gerar os arquivos de produção: `npm run build`. O resultado fica em `dist/`. O build também gera `dist/orquestra.html`, uma versão com código e fontes embutidos. Mantenha junto dela a pasta `dist/pdfjs/`: ela contém o worker e os dados de fonte/CMap/licença usados pelo leitor offline de PDF. O aplicativo Electron inclui esses arquivos locais.

## Seleção como no Desktop do Windows

Com a ferramenta **Selecionar (V)**, arraste em uma área vazia do canvas para desenhar o retângulo azul. A seleção é atualizada enquanto você arrasta, em qualquer direção, incluindo elementos parcialmente tocados pela área. Setas conectadas e traços livres são testados na posição em que aparecem no quadro.

- **Ctrl + clique** alterna um elemento; **Ctrl + arraste** alterna os elementos tocados pelo retângulo em relação à seleção inicial.
- **Shift + clique/arraste** acrescenta elementos sem perder a seleção anterior.
- **Ctrl + A** seleciona os elementos da seção atual. Um clique no fundo ou **Esc** limpa a seleção. Durante um arraste, **Esc** cancela e restaura o estado anterior.
- Arraste qualquer elemento selecionado para mover o conjunto. O arraste inteiro pode ser desfeito com **Ctrl + Z**. Cliques e seleções não criam etapas no histórico.
- **Setas** movem a seleção 1 unidade do canvas; **Shift + setas** movem 10.
- **Ctrl + C / V / X** copiam, colam e recortam dentro do editor. **Ctrl + D** duplica; **Delete** exclui. Os campos de texto continuam usando seus atalhos normais.

Ícones, textos, formas, imagens, vídeos, áudio, anexos e links participam da seleção. Para interagir com os controles de uma mídia, use duplo clique; **Esc** encerra a interação. Caixas vazias de molduras não capturam o retângulo iniciado no seu interior. Conexões internas são mantidas ao mover/copiar ambos os blocos; setas selecionadas sem todos os seus blocos são desvinculadas dos extremos externos para acompanhar o movimento. A seleção é temporária e não aparece na exportação PNG/SVG.

A cópia de mídias dentro do mesmo aplicativo reaproveita os arquivos locais. Para transferir entre computadores ou entre navegador e Windows, use o backup do projeto com as mídias incorporadas.

Evidências e limites da versão: [verificação de seleção](design/VERIFICACAO-SELECAO.md).

## Ícones, mídia e arquivos

Use **I** ou o botão de formas na barra lateral para abrir os **109 ícones vetoriais**, com busca em português e categorias. Insira, redimensione e ajuste a cor; cada ícone também recebe as animações do editor.

Use **U** ou o botão de imagem para inserir arquivos. Aceita PNG, JPG, WebP, GIF, SVG, AVIF e BMP; vídeos MP4, WebM, OGV e MOV; áudio MP3, WAV, OGG, M4A e FLAC; PDF, documentos Office, TXT, Markdown, CSV, JSON e ZIP. Vídeo e áudio são reproduzidos no board quando o codec é compatível com o player. PDF continua sendo mídia local transportável nos backups; use **Visualizar PDF** no cartão ou duplo clique para abrir o leitor. Ele navega páginas em rolagem, mostra o número atual/total, oferece zoom, ajuste à largura/página, tela cheia e download do original. O worker PDF.js, fontes e demais dados são locais; nenhuma conexão externa é necessária para abrir o documento. Links/anotações do PDF são desativados. Outros documentos aparecem como anexos que podem ser salvos. Limite de **100 MB por arquivo**.

Também é possível arrastar arquivos para o canvas e colar imagens do clipboard. Imagens e GIFs aparecem diretamente; dê **duplo clique** em vídeo, áudio, anexo ou link para interagir. Durante a apresentação, os controles de mídia ficam ativos. No painel Estilo, ajuste posição X/Y, largura, altura, ordem das camadas e modo de recorte da imagem/vídeo. Vídeos e áudio podem repetir, iniciar ao serem revelados e ficar sem som.

A aba **Link** cria cartões de referências HTTPS, inclusive YouTube. Páginas comuns mantêm a prévia modal em iframe com sandbox; **Abrir no navegador** continua disponível para sites que bloqueiam incorporação. Links do YouTube viram um player 16:9 selecionável no canvas: a barra contextual permite editar o endereço, abrir externamente e ativar/desativar a reprodução. O iframe só é criado após uma ação explícita; Escape, clique fora ou o botão de saída encerra a interação, e o resize pausa o player. O endereço/título do cartão permanecem no projeto. Para manter conteúdo de vídeo disponível offline, importe o arquivo local. Consulte [o plano e as evidências de QA do Link Preview](design/PLANO-LINK-PREVIEW.md).

No Windows, os arquivos ficam na subpasta `media` dos dados do aplicativo. No navegador, ficam no IndexedDB. O projeto guarda as referências; os backups JSON de projeto e biblioteca incorporam os arquivos utilizados, permitindo transportar o trabalho. A importação recria identidades de mídia, preservando os arquivos existentes. O limite de mídia por backup é **200 MB**. Arquivos guardados permanecem no repositório local mesmo após remoção de um elemento, preservando referências usadas no histórico; o backup inclui apenas arquivos efetivamente referenciados pelos projetos exportados.

PNG e SVG são exportações estáticas: títulos de moldura e conectores usam a mesma geometria do canvas, imagens são incorporadas, vídeos usam o quadro disponível no momento da exportação e áudio/anexos/links aparecem como cartões. Use o backup JSON para manter a reprodução e as animações.

## Animações

No painel **Estilo**, cada elemento pode aparecer suavemente, ser revelado como desenho, subir, entrar pela esquerda, aproximar, saltar, ganhar foco ou virar. A opção sem animação também está disponível. Ajuste a duração e a etapa de revelação; use **Prévia das animações** para conferir durante a edição.

As setas têm fluxo para frente ou reverso, pulso, partículas que percorrem o caminho, desenho contínuo ou estado parado, além de ajuste de ciclo e traçado contínuo/tracejado/pontilhado.

Cada seção tem transição própria: corte, dissolução, deslizamento, aproximação, desfoque ou virada, com duração ajustável. Em **Projetos**, configure a transição e duração ao abrir outro projeto. As animações respeitam a preferência de movimento reduzido do sistema.

## Editor

Dê duplo clique no fundo vazio para criar texto e em um texto existente para editá-lo. No painel **Estilo**, o campo **Texto do elemento** também permite revisar o conteúdo; **Fonte** oferece 20 opções agrupadas em sem serifa, com serifa, monoespaçadas, manuscritas e destaque, incluindo Caveat, DM Sans, Arial, Calibri, Segoe UI, Times New Roman, Consolas e Segoe Print. Segure **Shift** ao desenhar ou redimensionar retângulos e elipses para manter lados iguais.

O painel **Estilo** tem cores independentes de borda, texto e preenchimento, transparência e opacidade. Ao selecionar um cartão **Agente**, use **Símbolo do cartão** para escolher um ícone da biblioteca. Na aba de engrenagem **Configurações do board**, em **Aparência do quadro**, escolha tema claro/escuro, cor de destaque e fundo com pontos, grade ou liso. A aparência fica salva neste dispositivo; fontes, preenchimentos e símbolos acompanham o projeto e seus backups.

- Canvas com pan, zoom e enquadramento dos elementos.
- Seleção múltipla por Shift + clique ou arraste em uma área vazia.
- Retângulos, elipses, molduras com título próprio no topo, notas, texto, desenho livre e blocos de agentes. O título do frame é editável pelo painel Estilo ou por duplo clique no texto; deixe o campo vazio para ocultá-lo.
- Conectores com portas norte/leste/sul/oeste aparecem nos elementos selecionados ou sob interação. Arraste uma porta para criar uma seta; para reconectar, arraste uma extremidade ou clique nela e depois numa porta específica. O modo mostra os destinos elegíveis, exclui o outro extremo e oferece prévia encaixada. Escape cancela; reconexões/desconexões são uma operação de undo. Conectores acompanham movimento e redimensionamento.
- Duplo clique edita o texto. A alça inferior direita redimensiona elementos.
- Cores, preenchimento, tamanho de texto, animação e etapa no painel Estilo.
- Histórico de até 80 alterações, duplicação e exclusão.
- Seções editáveis, criação, exclusão e reordenação.
- Salvamento automático neste navegador e tema claro/escuro persistente.
- Exportação do projeto em JSON; importação de projetos Orquestra; exportação de seção em SVG e PNG, com fontes embutidas no SVG.

## Organização, texto e versões

No painel **Estilo**, selecione dois ou mais elementos para alinhar, distribuir ou redimensionar juntos pelas oito alças da seleção. Cantos mantêm proporção; Shift e Alt ajustam a operação. A seleção não precisa ser agrupada, e grupos/bloqueios são respeitados. Use **Ctrl+G** para formar um grupo persistente e **Ctrl+Shift+G** para desfazê-lo. **Configurações do board** permite ligar encaixe na grade e guias de alinhamento; segurar **Alt** durante o arraste suspende os encaixes. A tolerância das guias é definida em pixels de tela, portanto acompanha o zoom.

Na aba **Seções**, os campos semânticos de nome, título e subtítulo também podem ser selecionados e movidos diretamente no canvas. A alça redimensiona largura e fonte; o painel oferece X/Y, largura, tamanho, alinhamento e restauração por campo ou em conjunto. O subtítulo vazio continua vazio, mas pode ser editado pelo painel. O layout é opcional e boards antigos preservam as posições originais; SVG/PNG/PDF e cartões estáticos compartilham esse layout.

A aba **Camadas** permite selecionar, nomear, reordenar, ocultar e bloquear elementos. A visibilidade e o bloqueio de um grupo valem para seus membros; camadas ocultas não aparecem na exportação. Itens ocultos e bloqueados continuam recuperáveis pelo painel. Textos têm controles de negrito, itálico, alinhamento e entrelinha; textos novos ajustam a altura automaticamente e essa opção pode ser alterada no painel **Estilo**.

Estilos reutilizáveis são salvos por projeto no mesmo painel. Eles guardam aparência (cores, preenchimento, opacidade, fonte, formatação e estilo de seta); aplicar um estilo mantém o texto, a mídia, a posição, as dimensões e a animação do elemento. Os modelos de seção incluem opções iniciais e modelos personalizados, que podem ser inseridos mais de uma vez como cópias independentes. O backup da biblioteca inclui modelos personalizados e os arquivos de mídia referenciados.

Em **Projetos**, abra o relógio do projeto para criar versões manuais, consultar salvamentos automáticos e restaurar um snapshot após confirmação. A restauração valida o projeto e suas mídias e cria uma cópia de segurança da versão atual antes da troca. A retenção mantém até 30 versões por projeto e usa um teto de 100 MiB para snapshots; as mídias não são duplicadas. O salvamento automático de versões requer alterações e intervalo mínimo de cinco minutos.

**Exportar board inteiro (.pdf)** gera uma página A4 horizontal por seção, na ordem do projeto, sem depender da etapa de apresentação. O Electron usa a impressão para arquivo; no navegador, a janela de impressão oferece **Salvar como PDF**. Conteúdo de vídeo, áudio, links e anexos usa representação estática.

SVG, PNG, PDF e **Enquadrar seção** usam os mesmos limites de conteúdo. Eles incluem itens visíveis, conectores, títulos com quebra real de linha, sublinhados e o ornamento do subtítulo, mesmo fora do retângulo padrão; a moldura mínima continua 1140 × 825 com margem de 30 px. Todas as alças, guias, portas e caixas de seleção são removidas das exportações, preservando textos, setas e imagens embutidas.

Na versão-fonte **1.6.0**, `npm test` cobre 60 casos, incluindo contratos de portas, transformações múltiplas (âncoras cruzadas, mínimo por eixo, Shift/Alt e `autoHeight`), layouts semânticos, limites compartilhados de exportação e compatibilidade dos boards antigos. O fluxo Electron de desenvolvimento (`ORQUESTRA_TEST_SOURCE=1`) foi executado com perfil temporário: verifica UI a 800 × 600, gestos reais de seleção/redimensionamento/undo/redo/cancelamento, seções e conexões a 48% e 207%, exportações SVG/PNG/PDF com seleção coletiva, cabeçalho e modo de ponta ativos, mídia/PDF e a regressão do Link Preview comum. A exportação SVG real não contém auxiliares de edição e preserva a imagem embutida; o PNG real foi decodificado e teve 327.600 pixels amostrados pintados; o PDF real contém a moldura SVG completa, o sublinhado fora do canvas, o operador de imagem e o nome da seção em DM Sans. A extração de texto do PDF é parcial para as fontes de manuscrito/subconjunto, por isso o teste confere o nome completo e os inícios do título/subtítulo, não todas as palavras; SVG e PNG mantêm o texto inteiro. O fluxo YouTube confirma o iframe inline, URL/contexto, cabeçalho `Referer`, encerramento/pausa e erros de runtime. Com `ORQUESTRA_TEST_YOUTUBE_PLAYBACK=1`, o teste separado consulta o vídeo no frame Electron e só passa quando `readyState >= 2`, `paused === false` e `currentTime` avança pelo menos 0,5 s entre leituras. Evidências e capturas ficam em `.qa/`, incluindo `packaged-smoke.json`, `pdf-connections-frames-flow.json`, `link-preview-flow.json`, `export-active-collective.svg`, `export-active-collective.png`, `export-active-endpoint.svg`, `export-expanded-board.pdf`, telas 800 × 600 e os estados do player/cabeçalhos. O mesmo fluxo, sem playback real do YouTube, passou depois no executável empacotado `release/win-unpacked/Orquestra.exe`. O instalador NSIS 1.6.0 foi gerado; o assistente de instalação não foi executado. O build avisa que o bundle JavaScript minificado excede 500 kB.

## Apresentação

O botão **Apresentar** oculta as ferramentas. Use as setas ou espaço para avançar pelas etapas. Cada elemento tem uma etapa, configurada em Estilo; etapa 0 aparece na abertura. O botão Play reproduz as etapas automaticamente, respeitando a duração da seção. As setas recebem fluxo animado; os elementos podem aparecer suavemente ou com efeito de desenho. Esc encerra.

## Atalhos

`V` seleção · `H` mão · `R` retângulo · `O` elipse · `A` seta · `P` desenho · `T` texto · `N` nota · `F` moldura · `G` agente · `E` borracha. `Ctrl+Z` desfaz, `Ctrl+Shift+Z` refaz, `Ctrl+D` duplica, `Delete` exclui, `0` enquadra, `?` abre a ajuda. Rolar move o canvas; Ctrl + rolar ajusta o zoom no cursor; espaço + arraste move a tela.

## Escopo

O quadro funciona por seções independentes, com um canvas livre em cada uma. O exemplo inicial possui seis seções sobre agentes. A referência visual está em `design/concept.png`; a origem é o vídeo indicado pelo usuário, observado nos trechos de 45s e 80s.

Esta versão usa um editor SVG próprio. Não incorpora os SDKs tldraw/Excalidraw e não importa seus formatos de projeto. Os dados ficam no dispositivo: sincronização, colaboração multiusuário, execução de agentes e gravação de vídeo não fazem parte desta versão. Exporte um backup JSON para transportar ou preservar o trabalho. A edição é otimizada para desktop; no celular o roteiro fica recolhido inicialmente.

As fontes Caveat e DM Sans são servidas localmente. As licenças ficam em `public/fonts/`.
