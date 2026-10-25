# Orquestra

Whiteboard local para desenhar e apresentar explicações sobre orquestração de agentes. React, TypeScript, Vite e aplicativo Windows com Electron, sem backend ou chaves de API.

## Windows

O instalador está em `release/Orquestra-Setup-1.3.0-x64.exe`. Instala por usuário, com atalhos na Área de Trabalho e no menu Iniciar. Não requer um servidor Vite aberto. O executável empacotado também fica em `release/win-unpacked/Orquestra.exe`; mantenha a pasta inteira caso use essa versão.

A biblioteca é gravada em `%APPDATA%\Orquestra\biblioteca.json`, com a versão anterior em `biblioteca.json.bak`. Em **Projetos → Abrir pasta de dados** é possível localizar os arquivos. As gravações são serializadas e usam um arquivo temporário antes da substituição; o fechamento normal aguarda a gravação da última edição. A desinstalação preserva os dados. O instalador desta versão não tem assinatura digital.

Para levar projetos do navegador ao Windows, use **Projetos → Backup da biblioteca** no navegador e **Projetos → Importar projetos** no aplicativo. Também é possível importar os antigos arquivos de quadro JSON.

```powershell
npm run desktop     # compila e abre o app
npm run dist:win    # gera instalador Windows x64
npm test           # testes de projetos, armazenamento, mídia e seleção
node scripts/test-desktop.mjs  # fluxo Electron com perfil temporário isolado
node scripts/test-packaged.mjs # fluxo no executável empacotado com perfil isolado
node scripts/test-customization.mjs # edição, fontes, formas, cores, símbolos e tema
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

Abra http://localhost:5281. Para gerar os arquivos de produção: `npm run build`. O resultado fica em `dist/`. O build também gera `dist/orquestra.html`, uma versão em arquivo único com código e fontes embutidos, que pode ser aberta diretamente no navegador.

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

Use **U** ou o botão de imagem para inserir arquivos. Aceita PNG, JPG, WebP, GIF, SVG, AVIF e BMP; vídeos MP4, WebM, OGV e MOV; áudio MP3, WAV, OGG, M4A e FLAC; PDF, documentos Office, TXT, Markdown, CSV, JSON e ZIP. Vídeo e áudio são reproduzidos no board quando o codec é compatível com o player. PDFs e documentos aparecem como anexos que podem ser salvos; não há um leitor de PDF embutido. Limite de **100 MB por arquivo**.

Também é possível arrastar arquivos para o canvas e colar imagens do clipboard. Imagens e GIFs aparecem diretamente; dê **duplo clique** em vídeo, áudio, anexo ou link para interagir. Durante a apresentação, os controles de mídia ficam ativos. No painel Estilo, ajuste posição X/Y, largura, altura, ordem das camadas e modo de recorte da imagem/vídeo. Vídeos e áudio podem repetir, iniciar ao serem revelados e ficar sem som.

A aba **Link** cria cartões de referências HTTPS, inclusive YouTube, que abrem no navegador. Para reproduzir um vídeo dentro do board, importe o arquivo local.

No Windows, os arquivos ficam na subpasta `media` dos dados do aplicativo. No navegador, ficam no IndexedDB. O projeto guarda as referências; os backups JSON de projeto e biblioteca incorporam os arquivos utilizados, permitindo transportar o trabalho. A importação recria identidades de mídia, preservando os arquivos existentes. O limite de mídia por backup é **200 MB**. Arquivos guardados permanecem no repositório local mesmo após remoção de um elemento, preservando referências usadas no histórico; o backup inclui apenas arquivos efetivamente referenciados pelos projetos exportados.

PNG e SVG são exportações estáticas: imagens são incorporadas, vídeos usam o quadro disponível no momento da exportação e áudio/anexos/links aparecem como cartões. Use o backup JSON para manter a reprodução e as animações.

## Animações

No painel **Estilo**, cada elemento pode aparecer suavemente, ser revelado como desenho, subir, entrar pela esquerda, aproximar, saltar, ganhar foco ou virar. A opção sem animação também está disponível. Ajuste a duração e a etapa de revelação; use **Prévia das animações** para conferir durante a edição.

As setas têm fluxo para frente ou reverso, pulso, partículas que percorrem o caminho, desenho contínuo ou estado parado, além de ajuste de ciclo e traçado contínuo/tracejado/pontilhado.

Cada seção tem transição própria: corte, dissolução, deslizamento, aproximação, desfoque ou virada, com duração ajustável. Em **Projetos**, configure a transição e duração ao abrir outro projeto. As animações respeitam a preferência de movimento reduzido do sistema.

## Editor

Dê duplo clique no fundo vazio para criar texto e em um texto existente para editá-lo. No painel **Estilo**, o campo **Texto do elemento** também permite revisar o conteúdo; **Fonte** oferece 20 opções agrupadas em sem serifa, com serifa, monoespaçadas, manuscritas e destaque, incluindo Caveat, DM Sans, Arial, Calibri, Segoe UI, Times New Roman, Consolas e Segoe Print. Segure **Shift** ao desenhar ou redimensionar retângulos e elipses para manter lados iguais.

O painel **Estilo** tem cores independentes de borda, texto e preenchimento, transparência e opacidade. Ao selecionar um cartão **Agente**, use **Símbolo do cartão** para escolher um ícone da biblioteca. Na aba de engrenagem **Configurações do board**, em **Aparência do quadro**, escolha tema claro/escuro, cor de destaque e fundo com pontos, grade ou liso. A aparência fica salva neste dispositivo; fontes, preenchimentos e símbolos acompanham o projeto e seus backups.

- Canvas com pan, zoom e enquadramento dos elementos.
- Seleção múltipla por Shift + clique ou arraste em uma área vazia.
- Retângulos, elipses, molduras, notas, texto, desenho livre e blocos de agentes.
- Setas conectadas a blocos acompanham sua movimentação.
- Duplo clique edita o texto. A alça inferior direita redimensiona elementos.
- Cores, preenchimento, tamanho de texto, animação e etapa no painel Estilo.
- Histórico de até 80 alterações, duplicação e exclusão.
- Seções editáveis, criação, exclusão e reordenação.
- Salvamento automático neste navegador e tema claro/escuro persistente.
- Exportação do projeto em JSON; importação de projetos Orquestra; exportação de seção em SVG e PNG, com fontes embutidas no SVG.

## Apresentação

O botão **Apresentar** oculta as ferramentas. Use as setas ou espaço para avançar pelas etapas. Cada elemento tem uma etapa, configurada em Estilo; etapa 0 aparece na abertura. O botão Play reproduz as etapas automaticamente, respeitando a duração da seção. As setas recebem fluxo animado; os elementos podem aparecer suavemente ou com efeito de desenho. Esc encerra.

## Atalhos

`V` seleção · `H` mão · `R` retângulo · `O` elipse · `A` seta · `P` desenho · `T` texto · `N` nota · `F` moldura · `G` agente · `E` borracha. `Ctrl+Z` desfaz, `Ctrl+Shift+Z` refaz, `Ctrl+D` duplica, `Delete` exclui, `0` enquadra, `?` abre a ajuda. Rolar move o canvas; Ctrl + rolar ajusta o zoom no cursor; espaço + arraste move a tela.

## Escopo

O quadro funciona por seções independentes, com um canvas livre em cada uma. O exemplo inicial possui seis seções sobre agentes. A referência visual está em `design/concept.png`; a origem é o vídeo indicado pelo usuário, observado nos trechos de 45s e 80s.

Esta versão usa um editor SVG próprio. Não incorpora os SDKs tldraw/Excalidraw e não importa seus formatos de projeto. Os dados ficam no dispositivo: sincronização, colaboração multiusuário, execução de agentes e gravação de vídeo não fazem parte desta versão. Exporte um backup JSON para transportar ou preservar o trabalho. A edição é otimizada para desktop; no celular o roteiro fica recolhido inicialmente.

As fontes Caveat e DM Sans são servidas localmente. As licenças ficam em `public/fonts/`.
