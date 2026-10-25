# Orquestra 1.2.0 — ícones, mídia e movimento

## Resultado

Instalador `release/Orquestra-Setup-1.2.0-x64.exe` gerado e executável `release/win-unpacked/Orquestra.exe` testado com perfil temporário isolado. O instalador não foi executado e permanece sem assinatura digital. O editor anterior, a biblioteca e a migração de dados foram preservados.

Evidências do executável real: [board com mídia](windows-media-board.png) e [biblioteca de ícones](windows-icon-library.png), capturadas por CDP do próprio Electron e inspecionadas com `view_image`. A direção visual existente foi mantida: fundo escuro, menta, DM Sans nos controles, Caveat no canvas e ícones Lucide vetoriais. A mídia usa controles reais de reprodução. Não há uma nova imagem conceitual: a alteração amplia o sistema existente.

## Verificações realizadas

| Verificação          | Evidência                                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                | TypeScript, Vite, HTML autocontido, módulo compartilhado e NSIS concluídos.                                                                                                                                 |
| Testes automatizados | 10 testes passaram: projetos, migração, mesclagem, escrita/backup, conteúdo binário em backup, importação com novos IDs, mídia ausente, novos campos e links inválidos.                                     |
| Windows real         | Criação de projeto, busca/inserção de ícone, seleção de arquivos pelo input nativo e gravação das mídias em disco.                                                                                          |
| Reprodução           | WebM/VP9 e WAV/PCM avançaram no tempo de reprodução no executável. A asserção de áudio aguarda a inicialização do dispositivo, em vez de um atraso fixo curto.                                              |
| Recarga              | Imagem, vídeo e áudio recuperados após recarregar o executável; imagem presente e vídeo/áudio com `readyState=4`.                                                                                           |
| Encerramento         | Teste Electron separado confirmou gravação da última edição antes de fechar; sem erros de console coletados.                                                                                                |
| Ícones               | Catálogo com 109 entradas, categorias e busca sem acentos; busca “banco” e inserção de banco de dados no navegador, robô no executável.                                                                     |
| Entradas             | As nove opções foram selecionadas no navegador. CSS calculado: none, appear, draw-in, entry-up, entry-left, entry-zoom, entry-bounce, entry-blur e entry-flip.                                              |
| Setas                | Partículas renderizadas e movimento confirmado pela mudança da matriz de transformação ao longo do caminho no executável.                                                                                   |
| Seções               | As seis transições foram selecionadas e acionadas entre seções. CSS calculado correspondeu a none/scene-fade/scene-slide/scene-zoom/scene-blur/scene-flip; a transformação da câmera permaneceu preservada. |
| Projetos             | Seleção de virada na biblioteca e abertura de outro projeto aplicaram a transição configurada no executável.                                                                                                |
| Edição               | Posição, tamanho e camadas exercitados; mídia e ícone organizados pela interface antes da captura.                                                                                                          |
| Navegador            | PNG, GIF, MP4/H.264, WebM e WAV carregados. Dois vídeos chegaram a `readyState=4`, sem cartões de erro.                                                                                                     |
| Clipboard/drop       | Eventos de colagem de imagem e drop de arquivo percorreram os handlers reais e adicionaram imagens, sem ler ou alterar o clipboard do usuário.                                                              |
| Exportação           | JSON de projeto com quatro arquivos incorporados foi baixado e reimportado; as mídias voltaram a carregar. PNG foi baixado e inspecionado com o quadro de vídeo e cartões estáticos.                        |
| Mobile               | 390 × 844 sem overflow horizontal; catálogo de ícones e inserção de arquivos conferidos. Desktop: 1440 × 900 e captura do Electron com escala do Windows.                                                   |

## Limites e escopo

Arquivos locais de até 100 MB; até 200 MB de mídia por backup portátil. Formatos de vídeo/áudio dependem dos codecs disponíveis no player. Foram testados os codecs acima; MOV/OGV e todos os demais codecs não foram exercitados. GIF é exibido como imagem animada, enquanto exportações PNG/SVG são estáticas.

PDF e Office são anexos para salvar, sem visualizador interno. Links HTTPS abrem no navegador; vídeos do YouTube não são embutidos no player do board. SVGs importados são tratados como imagens e passam por limpeza de scripts, atributos de evento e referências externas.

O navegador guarda binários no IndexedDB; o aplicativo usa arquivos na pasta de dados, mantendo a biblioteca JSON leve e o histórico sem cópias de vídeo. Backups portáteis incorporam os binários referenciados. A importação valida e remapeia as identidades antes de acrescentar os projetos. O fechamento aguarda inserções pendentes antes de salvar.

As verificações de interface usaram o navegador colaborativo T3. Capturas T3 estavam comprimidas; as evidências visuais finais vieram do executável Electron. Algumas chamadas de clique/snapshot T3 excederam 15 segundos na limpeza; os projetos de teste foram removidos pelos mesmos handlers DOM, com nome e confirmação conferidos. O projeto original foi mantido com 12 elementos na primeira seção; 12 arquivos de teste sem referências foram removidos do IndexedDB. Perfis nativos de teste foram apagados após cada execução.
