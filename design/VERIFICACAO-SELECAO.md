# Orquestra 1.3.0 — seleção por área

O editor mantém a direção visual existente e acrescenta seleção semelhante à área de trabalho do Windows: retângulo azul translúcido, atualização durante o arraste e contornos dos elementos selecionados. A seleção funciona em qualquer direção e inclui interseções parciais.

## Comportamento

- Ctrl alterna elementos por clique ou retângulo; Shift acrescenta à seleção.
- Ctrl+A seleciona a seção atual. Clique no fundo ou Esc limpa a seleção.
- Esc durante um arraste restaura a seleção ou a posição anterior, sem consumir o histórico.
- Arrastar um elemento selecionado move o conjunto; setas movem 1 unidade, Shift+setas movem 10.
- Copiar, recortar, colar, duplicar, excluir e desfazer funcionam para o conjunto. Campos de texto mantêm seus atalhos.
- Ícones, mídia, anexos, links, formas, texto, traços e setas participam da seleção. A seleção de traços e setas acompanha a geometria renderizada. O interior vazio de uma moldura permite iniciar o retângulo.
- Conexões internas são preservadas ao copiar/mover os dois blocos; uma seta movida sem todos os seus blocos é desvinculada dos extremos externos.

## Validação

`npm test`: 16 testes passaram, incluindo seis testes de seleção, geometria e identidade de elementos, além das verificações existentes de projetos, armazenamento e mídia.

`node scripts/test-packaged.mjs`: o executável Windows foi exercitado com eventos reais de mouse e teclado via CDP, usando perfil temporário. O fluxo verificou seleção ao vivo, sentidos opostos, Ctrl/Shift, movimento em grupo, Esc, setas, copiar/recortar/colar, Delete, desfazer/refazer, zoom e pan. O conteúdo terminou idêntico ao inicial. A captura [windows-selection.png](windows-selection.png) foi obtida durante o arraste e inspecionada visualmente.

A cópia foi validada com eventos ClipboardEvent e DataTransfer isolado, sem alterar o clipboard pessoal do usuário. A transferência pelo clipboard entre aplicativos distintos não foi testada; para transportar mídias entre dispositivos, use backup com arquivos incorporados.

O mesmo fluxo confirmou reprodução e recuperação de imagem, vídeo e áudio após recarga, catálogo de 109 ícones, partículas nas setas, transições e persistência dos projetos. `node scripts/test-desktop.mjs` também confirmou gravação da última edição ao fechar, recuperação em disco e ausência de erros coletados.

Durante a verificação, um evento atrasado de perda de captura do mouse cancelava o arraste seguinte. O cancelamento foi concentrado em Esc e pointercancel; a captura normal do ponteiro mantém o arraste até a soltura. A conversão das coordenadas usa a matriz efetivamente exibida, incluindo zoom e pan, e interrompe transições de câmera ao iniciar edição.

## Entrega e limites

Instalador: `release/Orquestra-Setup-1.3.0-x64.exe`. Build TypeScript/Vite, HTML autocontido e NSIS x64 gerados. O executável empacotado foi testado; o assistente do instalador não foi executado. O instalador permanece sem assinatura digital.

A seleção é temporária, restrita à seção atual e não aparece nas exportações PNG/SVG. O redimensionamento por alça continua individual; o movimento e os comandos de edição operam no conjunto. A biblioteca pessoal existente não foi alterada pelos testes.
