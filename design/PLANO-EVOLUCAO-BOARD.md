# Plano de evolução do Orquestra

## Objetivo e escopo

Implementar as oito melhorias propostas na conversa, em uma entrega integrada: alinhamento e guias; grupos e bloqueio; formatação de texto; camadas; estilos reutilizáveis; modelos de seções; PDF completo; histórico persistente de versões. A interface permanece em português e funciona offline no aplicativo Windows. Preservar as funções existentes, os projetos e as referências de mídia.

Implementação delegada ao provider Codex, modelo GPT-6-Luna, reasoningEffort xhigh. A revisão, a validação do executável e a atualização da instalação pertencem ao agente principal. Não fazer commit ou push automaticamente nesta tarefa.

## Regras de arquitetura e compatibilidade

- Ler o código atual antes de editar. Separar operações puras de geometria, agrupamento, modelos e estilos em módulos próprios; evitar concentrar toda a lógica nova em main.tsx.
- Acrescentar campos opcionais e defaults compatíveis em Item, Scene e Library. Projetos antigos continuam válidos e visualmente equivalentes. Validar tipos, enums, números e limites antes de persistir ou importar.
- Preservar cores independentes de texto, borda e preenchimento, as 20 fontes, símbolos de agentes, subtítulos, animações, mídia e configurações do board.
- Toda operação de usuário deve ser reversível pelo histórico da sessão quando aplicável. Um arraste ou ação coletiva gera um checkpoint; seleção e inspeção não geram checkpoints.
- Manter IDs estáveis ao editar; remapear IDs de itens, grupos e conectores ao duplicar/importar modelos, projetos ou seleções. Nunca ligar uma cópia aos objetos originais.
- Não adicionar serviços externos, telemetria ou dependências remotas. Reutilizar o SVG, Electron e o armazenamento existentes. Usar dependências novas somente se uma necessidade concreta não puder ser atendida pela base atual e documentar a decisão.

## Etapa 1 — Alinhamento, distribuição e guias

### Comportamento

- Com dois ou mais elementos editáveis selecionados: alinhar esquerda, centro horizontal, direita, topo, centro vertical e base.
- Com três ou mais: distribuir horizontalmente ou verticalmente, mantendo os elementos extremos e espaçando os demais por suas caixas visuais.
- Oferecer encaixe na grade e guias de alinhamento nas Configurações do board. As guias usam bordas e centros de objetos visíveis da seção.
- Usar tolerância em pixels de tela (por exemplo, 6 px), convertida pelo zoom. Alt suspende o encaixe durante o arraste. Shift mantém a função existente de formas simétricas.
- Grupos são unidades geométricas. Excluir objetos bloqueados ou ocultos das transformações; usar objetos visíveis bloqueados como referências de guia é permitido.
- Guias são temporárias, não aparecem em exportações nem são persistidas como objetos.

### Aceite

Testar alinhamento e distribuição com formas, texto e mídia, em zooms diferentes. Conectores continuam ligados após mover os extremos. Desfazer restaura a geometria completa em uma ação. Botões incompatíveis com a seleção ficam desabilitados.

## Etapa 2 — Grupos persistentes e bloqueio

### Comportamento

- Agrupar e desagrupar pela interface e por Ctrl+G / Ctrl+Shift+G fora de campos de texto. Esta entrega usa grupos planos, sem aninhamento.
- Clicar em um membro seleciona o grupo. Mover, copiar, duplicar e excluir respeitam a unidade do grupo e os conectores internos.
- Bloquear e desbloquear elementos ou grupos. Objetos bloqueados não podem ser movidos, redimensionados, editados, recortados ou excluídos pelo canvas/atalhos; continuam acessíveis no painel de camadas para desbloqueio.
- Persistir grupo e bloqueio no projeto, em backups e em importações.

### Aceite

Confirmar persistência após reiniciar, cópia com IDs independentes e exclusão segura. Verificar que operações de seleção, borracha, teclado e painel Estilo não contornam o bloqueio. Desagrupar não muda posição, estilos ou vínculos.

## Etapa 3 — Formatação de textos

### Comportamento

- Adicionar negrito, itálico, alinhamento à esquerda/centro/direita e espaçamento entre linhas no painel Estilo.
- Formatação uniforme por elemento nesta entrega; não é um editor de trechos com estilos mistos.
- Ajuste automático da altura ao conteúdo, com largura preservada e opção explícita para habilitar/desabilitar. Considerar fonte, peso, tamanho, entrelinha, padding e área reservada ao símbolo dos agentes.
- Aplicar o mesmo cálculo de quebra de linhas ao canvas, à edição e às exportações.
- Preservar os defaults visuais de textos, notas, formas e agentes antigos.

### Aceite

Testar parágrafos, quebras explícitas, acentos, fontes de sistema e fontes embutidas, alinhamentos e textos longos. O conteúdo não deve ser cortado com autoaltura habilitada. Formatação persiste e pode ser desfeita.

## Etapa 4 — Painel de camadas

### Comportamento

- Criar seção Camadas na lateral, com os elementos da seção atual, nomes legíveis e indicação de tipo, grupo, bloqueio e visibilidade.
- Permitir selecionar, renomear, ocultar/mostrar, bloquear/desbloquear e mover na ordem de empilhamento. Controles de subir/descer são obrigatórios; arrastar para ordenar é opcional.
- Renomear altera apenas o nome de organização, sem substituir o texto visível do objeto.
- Itens ocultos não participam de hit testing, seleção por área, guias, apresentação ou exportação; reaparecem ao mostrar novamente.
- Sincronizar a seleção entre canvas e lista. Grupos aparecem de forma compreensível, com membros identificáveis.

### Aceite

Conferir ordem visual real, seleção após reordenação e recuperação de elementos ocultos/bloqueados. Nomes, ordem e estados persistem após recarregar. Evitar overflow horizontal nas abas e no painel.

## Etapa 5 — Estilos reutilizáveis

### Comportamento

- Salvar um estilo do elemento selecionado com nome, listar, aplicar e excluir estilos salvos com confirmação adequada para exclusão.
- Incluir somente aparência: fonte, tamanho, peso, itálico, alinhamento, entrelinha, cores independentes, preenchimento e opacidade; incluir propriedades adicionais de borda se já suportadas.
- Não copiar conteúdo, posição, dimensões, IDs, vínculos, arquivos de mídia, bloqueio, visibilidade ou etapas de animação.
- Aplicar propriedades compatíveis a seleções múltiplas com um checkpoint. Informar onde os estilos são salvos e incluí-los no backup da biblioteca.

### Aceite

Aplicar estilo entre tipos diferentes sem corromper campos específicos. Confirmar persistência, backup/importação e que o texto e a geometria originais permanecem iguais.

## Etapa 6 — Modelos de seções

### Comportamento

- Oferecer modelos iniciais de fluxo de processo, organograma, mapa de ideias e apresentação simples.
- Permitir salvar a seção atual como modelo, nomear, inserir em um projeto e excluir modelos personalizados. Inserção acrescenta uma seção; não sobrescreve trabalho existente.
- Modelos preservam estilos, textos, grupos, conectores e animações. Remapear todas as identidades na inserção.
- Modelos personalizados com mídia devem usar referências válidas no dispositivo e participar do backup de biblioteca com os respectivos arquivos, pelos mecanismos de payload portátil existentes.

### Aceite

Inserir o mesmo modelo duas vezes sem colisões de IDs. Editar uma instância não altera o modelo nem a outra instância. Testar backup/importação de modelo com mídia e mensagens claras para falha ou limite de tamanho.

## Etapa 7 — PDF do board inteiro

### Comportamento

- Adicionar Exportar board em PDF, com uma página por seção, na ordem atual.
- Preservar cores, fontes, proporções e conteúdo visual; excluir ferramentas, seleções, guias e elementos ocultos. Exportação estática mostra todos os elementos visíveis sem depender da etapa atual da apresentação.
- No Windows, reutilizar Electron printToPDF com janela isolada e conteúdo local controlado. Expor somente IPC específico, validado e restrito ao remetente confiável. Descartar janela e recursos após sucesso/falha.
- Dimensionar cada seção para caber na página sem cortes. Vídeos, áudios, anexos e links usam a representação estática já adotada nas exportações.
- No navegador, oferecer o fluxo de impressão/salvar PDF apropriado e explicar a escolha de destino quando necessário; não prometer geração nativa idêntica ao Electron.
- Cancelamento ou falha não altera o projeto nem substitui um arquivo de destino incompleto.

### Aceite

Gerar PDF real com várias seções e confirmar número e ordem das páginas. Inspecionar páginas renderizadas com texto longo, fontes, mídia, elementos ocultos e cores independentes. Confirmar que a exportação não interfere no projeto aberto.

## Etapa 8 — Histórico persistente de versões

### Comportamento

- Separar versões persistentes do desfazer temporário da sessão. Acesso pelo gerenciador de Projetos ou por controle claramente identificado.
- Criar versões manuais nomeadas e versões automáticas quando houver mudança, com intervalo mínimo de 5 minutos; criar uma versão de segurança antes de restaurar.
- Listar data, nome e origem manual/automática. Restaurar somente após escolha explícita e confirmação, preservando a versão atual antes da troca.
- Limitar a retenção, inicialmente 30 versões por projeto e teto global de armazenamento de 100 MiB para snapshots de metadados. Explicar os limites na interface. Não duplicar os bytes de mídia a cada snapshot.
- No desktop, usar armazenamento separado por projeto no diretório de dados, gravação atômica e serializada. No navegador, usar IndexedDB ou armazenamento próprio com tratamento de quota.
- Validar o snapshot antes de restaurar; preservar arquivo e versão atual diante de corrupção, falta de mídia ou falha de gravação. Remoção por retenção ocorre somente após salvar a nova versão com sucesso.

### Aceite

Salvar, reiniciar e restaurar uma versão real. Testar snapshots idênticos, retenção, limite de tamanho, arquivo inválido e falha de persistência. Conferir restauração com grupos, modelos, estilos, textos e mídia; o projeto atual deve continuar recuperável.

## Sequência e dependências

1. Fazer inventário do estado atual e desenhar os campos opcionais e defaults comuns.
2. Implementar operações geométricas e de grupos; integrar alinhamento, guias e bloqueio.
3. Implementar texto e camadas sobre o mesmo modelo e as mesmas regras de seleção.
4. Implementar estilos e modelos usando clonagem, validação e importação já existentes.
5. Implementar PDF usando um render estático compartilhado, sem duplicar regras de aparência.
6. Implementar versões persistentes sobre snapshots validados e o armazenamento atômico.
7. Integrar a interface, revisar atalhos, acessibilidade, mensagens de erro e documentação.
8. Executar validação completa e preparar o aplicativo Windows atualizado.

## Estratégia de validação

- Testes unitários significativos para geometria, snap com zoom, grupos/IDs, bloqueio, estilos compatíveis, modelos, validação de dados e retenção/restauração de versões.
- Fluxos reais no Electron com perfil temporário isolado, usando os scripts existentes. Cobrir ações pelas interfaces e atalhos, salvar/recarregar, desfazer/refazer e confirmar o resultado persistido.
- Reexecutar os fluxos existentes de texto, 20 fontes, cores independentes, mídia, seleção, subtítulos e configurações do board quando a etapa afetar essas áreas.
- Conferir console e erros de runtime; revisar capturas em tamanho desktop e no tamanho mínimo suportado pelo app (800 × 600), com painéis roláveis e controles acessíveis.
- Testar importação de projeto antigo e backup/importação de uma biblioteca com todos os novos campos.
- Verificar PDF por arquivo gerado, páginas e renderização visual; não considerar um aviso de sucesso como prova suficiente.
- Testar versões em disco e recuperação após reinício; um contador na interface não comprova o salvamento.

## Entrega Windows e responsabilidades

- Atualizar a versão para 1.4.0 em package.json/package-lock e a documentação quando o conjunto estiver pronto.
- O implementador entrega código, testes executados, pendências reais e instruções de uso; não empacota nem substitui a instalação durante a delegação.
- O agente principal revisa a entrega, resolve problemas encontrados, executa os fluxos finais, gera o instalador com npm run dist:win e atualiza SHA256SUMS.txt.
- Fechar o Orquestra normalmente para permitir o último salvamento. Substituir os arquivos de release/win-unpacked na instalação confirmada em %LOCALAPPDATA%/Programs/Orquestra, mantendo o desinstalador.
- Verificar hashes de Orquestra.exe e resources/app.asar entre build e instalação; verificar que a biblioteca real não mudou durante a substituição. Não tocar nos dados de usuário, versões ou mídias.
- Executar smoke tests na cópia instalada com perfil isolado, reabrir o aplicativo e informar versão, evidências e limitações materiais.

## Conclusão do trabalho

A entrega só está concluída quando as oito capacidades tiverem interface funcional, persistência, compatibilidade e validação apropriadas, e o aplicativo instalado estiver atualizado. Nenhuma etapa deve ser declarada pronta apenas por existir um botão, um tipo de dados ou um teste que reproduza a própria implementação.

## Registro de execução do implementador

Atualizado em 25/10/2026. Estado inicial conferido antes da implementação: `git status` mostrava somente este plano como arquivo novo. O app usa React/TypeScript/Vite e Electron; o board é validado em `src/model.ts`, a biblioteca e clonagem ficam em `src/library.ts`, mídia em IndexedDB ou `desktop/main.cjs`, e salvamento da biblioteca em `src/persistence.ts` / `desktop/storage.cjs`. O editor SVG e os painéis existentes estão em `src/main.tsx`; os testes existentes cobrem biblioteca, mídia, seleção, Electron isolado e customização.

### Andamento por etapa

| Etapa | Estado | Evidência/pendência |
|---|---|---|
| 1. Alinhamento, distribuição, grade e guias | Implementada; validação parcial | UI Electron verificou alinhamento e distribuição em três retângulos; testes de unidade validaram encaixe/guia com zoom. Arraste real com grade e guias em vários níveis de zoom não foi exercitado no fluxo UI. |
| 2. Grupos persistentes e bloqueio | Implementada; validação parcial | Fluxo Electron verificou agrupar, persistir, bloquear com Delete, ocultar/recuperar e recarregar. Testes cobrem clonagem/IDs e regras. Todas as rotas de edição, como eraser e resize em combinações bloqueadas, ainda dependem de QA adicional. |
| 3. Formatação de texto | Implementada; validação parcial | Fluxo Electron verificou negrito, itálico, alinhamento, entrelinha e altura automática; fluxo de customização existente carregou fontes. Não foi feita inspeção visual de exportação estática para todos os layouts/textos longos. |
| 4. Painel de camadas | Implementada; validação parcial | Componente próprio e fluxo Electron verificaram seleção, renomeação, ocultação, recuperação e bloqueio. Reordenação de camada ainda não foi coberta pelo fluxo automatizado. |
| 5. Estilos reutilizáveis | Implementada; validação parcial | Fluxo Electron salvou e aplicou estilo sem mudar texto/posição/dimensões; testes verificaram campos compatíveis, conteúdo/geometria e backup. Remoção de estilo por confirmação não foi exercitada na UI. |
| 6. Modelos de seções | Implementada; validação parcial | Fluxo Electron salvou modelo e inseriu duas instâncias; testes verificaram identidades independentes e backup de modelo com mídia/estilo. Edição de uma instância e inspeção visual da outra, além da importação do backup pela UI, ficam para QA principal. |
| 7. PDF do board inteiro | Implementada; validação parcial | PDF real de duas páginas produzido no Electron e validado por assinatura/tipos de página. Ainda não foi verificado visualmente o PDF produzido pelo fluxo completo do board, sua ordem/conteúdo nem a janela de impressão de navegador. |
| 8. Histórico persistente de versões | Implementada; validação parcial | Fluxo Electron criou versões manuais, restaurou após confirmação, gerou versão de segurança e conferiu o estado depois de reload. Testes cobrem limite de 30 e preservação de snapshot inválido; intervalo automático de cinco minutos, quota IndexedDB e restauração com mídia ausente não foram simulados em runtime. |

### Validações executadas pelo implementador

- `npm test`: **30/30 aprovados**, incluindo geometria/snap, conectores, agrupamento, bloqueio, migração de board antigo, estilos, modelos e clonagem, backup de modelo com mídia, retenção e preservação de snapshots inválidos.
- `npm run build`: TypeScript, Vite e geração do HTML standalone concluídos. Vite informa somente o aviso conhecido de bundle principal acima de 500 kB.
- `node scripts/test-desktop.mjs`: Electron com diretório de dados temporário; persistência/reload, ausência de erros de runtime e PDF real de 18.563 bytes com assinatura `%PDF` e duas páginas detectadas.
- `$env:ORQUESTRA_TEST_SOURCE="1"; node scripts/test-packaged.mjs`: fluxo UI no Electron de desenvolvimento com perfil temporário; passou seleção, customização existente, agrupamento/bloqueio/camadas/texto, estilos, dois clones de modelo, versões manuais/restauração/segurança e reload.
- `$env:ORQUESTRA_TEST_SOURCE="1"; node scripts/test-customization.mjs`: fluxo existente de preservação de recursos passou, incluindo 20 fontes, texto, preenchimento e cor do texto independentes, configurações do board, símbolo de agente e persistência.
- Nenhum teste usou ou alterou a biblioteca real de `%APPDATA%`; o perfil Electron foi criado em `%TEMP%` e removido pelo script. Nenhum instalador foi gerado ou substituído nesta delegação.

O código e a validação automatizada das oito capacidades estão entregues para revisão. Os pontos explicitamente listados na tabela permanecem como aceite parcial: este registro não afirma inspeção visual completa de PDFs, fallback navegador, teste de arraste/zoom, quota IndexedDB, retenção automática após cinco minutos ou instalação Windows.

### Segunda rodada e revisão principal

O registro acima descreve a primeira rodada. Na segunda rodada, o Luna xhigh corrigiu o alinhamento de texto no render estático, os símbolos dos agentes, marcadores de setas com cores personalizadas, quebra/formatação de texto, validação de PDF/SVG e serialização de versões.

- `npm test`: **35/35 aprovados**; `npm run build` aprovado. O único aviso de build é o tamanho do chunk principal acima de 500 kB.
- O fluxo Electron foi ampliado para testar arraste com snap em dois zooms, suspensão com Alt, guias, bloqueio de edição/movimento/cópia/redimensionamento/borracha e proteção de conectores; reordenação de camadas, exclusão confirmada de estilos, independência de modelos e importação de biblioteca pela interface.
- O relógio foi controlado somente no teste para verificar o limite de cinco minutos e comprovar a versão automática no arquivo real do perfil temporário. A restauração com mídia ausente foi recusada preservando o projeto atual. Testes cobrem falha de armazenamento/quota e retenção.
- `node scripts/test-desktop.mjs` passou novamente na revisão principal: fechamento com último salvamento, reload e exportação real do board para PDF com **três páginas**. A ausência de mídia é uma falha intencional do teste, não um erro de produção.
- O PDF `.qa/board-acceptance.pdf` foi renderizado com PyMuPDF e suas três páginas foram inspecionadas visualmente: ordem Base / Cópia A / Cópia B, fontes, acentos, cores e conteúdo estático presentes. A extração textual do PDF tem limitações de mapeamento de glifos e não é usada como prova de fidelidade visual.
- A captura `.qa/board-800x600.png` foi inspecionada: barra de ferramentas visível, painel com rolagem interna e ausência de overflow horizontal externo.
- O fluxo sem bridge desktop foi exercitado em Chromium/Electron isolado carregando o HTML standalone: popup criado, seis páginas SVG, fontes carregadas e chamada a `window.print()` confirmada (`.qa/browser-print-smoke.json`). A escolha do destino no diálogo nativo do navegador permanece uma ação manual.
- O smoke empacotado agora executa também o fluxo completo das novas funcionalidades, em vez de restringi-lo ao modo de desenvolvimento.

O pacote Windows 1.4.0 foi gerado para a conferência final e substituição da instalação pelo agente principal. A evidência de instalação será registrada após verificar os hashes e os dados reais preservados.

### Aceite da instalação Windows

- `npm run dist:win` concluído: `release/Orquestra-Setup-1.4.0-x64.exe`; manifesto SHA256 atualizado.
- Os smokes completos de funcionalidades e customização passaram tanto em `release/win-unpacked/Orquestra.exe` quanto na cópia instalada em `%LOCALAPPDATA%/Programs/Orquestra/Orquestra.exe`, sempre com perfis temporários. Incluem 20 fontes, cores independentes, mídia, títulos/subtítulos e as oito melhorias.
- A conferência final de `npm test` passou em **35/35**. `git diff --check` não encontrou erros de whitespace.
- Os SHA256 de `Orquestra.exe` e `resources/app.asar` instalados coincidem com os do build. A biblioteca real manteve SHA256 `AE4705DEA056472B747E9EC9523AB30057F700CD1BDB9297DA0AB83CB700EAF4` antes/depois da substituição. Evidência: `.qa/installation-1.4.0.json`.
- O desinstalador foi preservado e nenhum dado real de projetos, mídia ou versões foi usado nos testes. Commit e publicação no GitHub não fazem parte desta rodada.
