# IA no Orquestra — integração e verificação

## Integração final 1.9.0

Compilado o instalador Windows e atualizado o aplicativo instalado. Hashes EXE/asar conferidos contra win-unpacked; hash da biblioteca preservado após fechamento normal. 102 testes unitários passaram. Fluxo IA passou no Electron de origem, no pacote e na instalação com perfis temporários: prévia editável, novo projeto, anexação/undo, referência PDF página 3 após reload, bytes originais e rollback sob falha controlada. Regressão do notch independente passou no pacote. Corrigidos cabeçalho compacto, cancelamento durante thread/start e herança de chaves de API do launcher. A geração E2E foi simulada somente via CDP no teste; login OAuth e inferência com conta real continuam sem validação. Evidências externas: Documents/Orquestra-AI-2026-10-27/ai-installed-flow.json e install-after.json.

## Implementação

O fluxo desktop usa o Codex CLI **0.164.0** instalado externamente e detectado no PATH; não há runtime empacotado nem fallback fictício. O processo principal mantém um `CODEX_HOME` próprio em `userData/codex-oauth`, com armazenamento de credenciais em arquivo, separado do perfil Codex/T3 existente. Login ChatGPT é iniciado apenas pelo botão Conectar, abre URL HTTPS em domínio oficial e pode ser cancelado; há consulta de conta/modelos e logout. Nenhum login ou inferência real foi realizado nesta etapa.

O transporte JSONL por stdio implementa initialize/initialized, `thread/start`, `turn/start` com schema, `turn/interrupt` e espera por `turn/completed`. Exige inicialização estrita com `shell_tool`, `unified_exec`, multiagentes, plugins, apps, navegador, imagem e busca desativados; usa diretório temporário vazio, política `never` e sandbox `readOnly` com rede de ferramentas desativada. Rejeita solicitações RPC do servidor e interrompe ao receber itens de ferramenta; só aceita JSON validado novamente no processo principal e no renderer. Não executa comandos propostos pelo modelo.

Essas camadas reduzem exposição, mas **não provam ausência de acesso ao sistema operacional**: um evento pode chegar após uma ação e a efetividade do sandbox depende do runtime e Windows. Não se deve anunciar isolamento absoluto. O controle de versão/configuração falha fechado se a versão esperada ou opções não forem aceitas. `tools.disable_defaults` não é uma opção reconhecida pela versão instalada e não é usada.

O diálogo aceita descrição, texto e PDF textual; fornece público, número e duração de seções, layout e destino. Apresenta roteiro editável antes de criar projeto ou anexar seções com um checkpoint de undo. Não lê nem envia notas do apresentador. PDFs: até 20 MB, 20 páginas selecionadas e 40 mil caracteres; extração local sem OCR, com erros para páginas sem texto, arquivos protegidos ou inválidos. O original é gravado apenas ao aplicar e removido se a gravação da biblioteca falhar; referências indicam a página no visualizador. O rollback é melhor esforço se o próprio sistema de arquivos falhar ao remover a mídia. O undo remove as referências do quadro, mas mantém a mídia gravada para permitir redo.

## Evidências e limites

- Schema gerado pela CLI local e configuração estrita testados usando CODEX_HOME temporário vazio, sem credenciais reais; versão reportada 0.164.0.
- Handshake real com perfil temporário: conta desconectada e oito modelos listados. Isso não confirma elegibilidade de uma conta ou geração.
- Testes unitários do transporte simulam respostas/eventos e verificam rejeição de RPC, saída JSON e cancelamento durante início; não existe modo falso em produção.
- `npx tsc -b --pretty false`, `npm test` (101 testes) e `npm run build` passaram nesta etapa. O build gera HTML standalone de um único bundle.
- Fluxo completo de login/inferência não foi testado, pois depende de ação e conta do usuário. A validação posterior de aplicação e rollback em perfil isolado está descrita abaixo. O navegador de prévia falhou duas vezes com `Preview automation snapshot timed out after 15000ms`, e o navegador alternativo IAB não estava disponível.
- A autorização comercial/hosted e condições de uso da autenticação OpenAI não foram verificadas. Não houve commit, push, empacotamento ou instalação.

Referências: [App server](https://learn.chatgpt.com/docs/app-server), [Configuração Codex](https://learn.chatgpt.com/docs/config-file/config-reference), [Sandbox Windows](https://learn.chatgpt.com/docs/windows/windows-sandbox), [SIWC e limites](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).


## Rodada 3 — Electron isolado, 2026-10-27

Executado em Electron a partir do código-fonte, com perfil temporário `--orquestra-test-data`; `ELECTRON_RUN_AS_NODE` removido pelo runner. A consulta real ao CLI externo retornou conta desconectada e oito modelos. Não houve login ou inferência real, nem acesso a credenciais ou biblioteca reais.

`ORQUESTRA_TEST_AI=1` em `scripts/test-packaged.mjs` executa `tests/ai-flow.mjs`: o CDP altera somente a variável da ponte no escopo do renderer durante a chamada de geração, fornecendo roteiro, falha e espera simulados. O teste verifica seleção de modelo, entrada vazia, erro e cancelamento, edição da prévia, novo projeto, anexação e desfazer. Para PDF, gera a fixture de três páginas existente em `tests/acceptance-flow.mjs`, verifica página inválida, extração da página 3, bytes originais, referência e visualizador na página 3 antes e depois de reload. Uma falha controlada no handler de gravação da biblioteca é injetada via Inspector do processo principal: a biblioteca e a lista de mídias permanecem iguais após rollback.

Capturas em `Documents/Orquestra-AI-2026-10-27`; modal nos temas claro e escuro, viewport efetivo 802x602 (janela solicitada 800x600) e 1440x900, sem overflow horizontal detectado. Corrigidos contraste no tema claro e posicionamento inicial do visualizador: a página solicitada antes podia ser deslocada pelo redimensionamento das páginas anteriores. O rollback não simula falha adicional na remoção de mídia; permanece melhor esforço. O teste simulado não comprova login, elegibilidade ou geração autenticada reais.

Comandos: `npm run build`; `npm test` (102 aprovados); `$env:ORQUESTRA_TEST_SOURCE='1'; $env:ORQUESTRA_TEST_AI='1'; node scripts/test-packaged.mjs`. Resultado detalhado em `.qa/ai-flow.json`. Sem pacote, instalação, commit ou push.

O smoke adicional `node scripts/test-desktop.mjs` retornou `passed: true`, incluindo persistência e PDF de três páginas, mas registrou no stderr um `ENOENT` em `asset:get` do presenter para uma mídia do próprio perfil temporário. O resumo do runner reportou `errors: []`; a causa desse registro não foi investigada nesta rodada.

## Fluxos ricos — 2026-10-27

O contrato compartilhado em `src/aiLayout.ts` versão 2 descreve seções, fases, nós, relações, papéis, ênfase, ícones restritos, etapas, animações e transições. O processo principal usa o mesmo `aiOutputSchema`; validação no processo principal e renderer rejeita chaves extras, IDs duplicados, referências inválidas, etapas fora de 0–20 e páginas não selecionadas. O formato anterior continua aceito. O layout usa faixas determinísticas por fase, dimensiona cartões pelo texto, aceita ciclos e cria molduras agrupadas, cartões, elipses, notas e conectores nativos com portas, rótulos e animação. A prévia usa `StaticScene` e os campos do roteiro atualizam o mesmo objeto aplicado. O diálogo permite selecionar detalhamento rico/simplificado e desligar animações.

Validação nesta rodada: `npx tsc -b`, `npm run build` e `npm test` (103 testes, incluindo os 102 anteriores). `ORQUESTRA_TEST_SOURCE=1 ORQUESTRA_TEST_AI=1 node scripts/test-packaged.mjs` passou em Electron com perfil temporário, resposta simulada por CDP e fixture com decisão Sim/Não, retorno, convergência, duas fases e texto longo. Verificados seis conectores, portas, grupo, edição de nó, etapas distintas na tela do público e classe de movimento, além de PDF/página 3, bytes, rollback, undo, cancelamento e rodapé em viewport efetivo 802×602. Capturas em `Documents/Orquestra-Rich-Flows-2026-10-27`; resultado em `.qa/ai-flow.json`. Não houve login ou inferência reais.

## Revisão dos layouts e simplificação — 2026-10-30

O compositor aplica três arranjos determinísticos para o contrato v2: fluxo em faixas de fase, mapa com objeto central e colunas laterais, e apresentação em ordem de leitura com tipografia maior. O mapa mantém o texto integral. As etapas originais são preservadas, inclusive etapas compartilhadas. O simplificado remove molduras, ícones, ênfase e movimento, mas conserva todos os nós, decisões, rótulos, arestas e suas direções; não depende da obediência do modelo. Animações desligadas removem entradas e movimento de setas e usam transição de corte. Referências PDF são colocadas fora dos cartões.

O roteamento escolhe portas nativas e posição de rótulo avaliando colisões e comprimento; os campos permanecem no modelo nativo usado por canvas, exportação e público. Não há desvio geral de obstáculos: grafos complexos ou alterações manuais podem exigir ajustes; não se garante ausência de cruzamentos ou colisões em qualquer grafo. Os testes verificam a fixture Sim/Não com retorno e convergência e uma cadeia de 18 nós, nos três layouts, com amostragem geométrica contra nós não relacionados; na fixture, os rótulos também são verificados contra cartões e entre si. Decisões continuam usando cartão com `?`.

Validação: `npx tsc -b --pretty false`, `npm test` (148 testes) e `npm run build`; Electron de origem via `ORQUESTRA_TEST_SOURCE=1 ORQUESTRA_TEST_AI=1 node scripts/test-packaged.mjs`, com perfil temporário e resposta simulada por CDP. Capturas de cada layout e do simplificado em `Documents/Orquestra-Rich-Flows-2026-10-27`; resultado em `.qa/ai-flow.json`. O teste verifica edição, referências PDF, undo, rollback controlado, apresentação e público. Não houve login ou inferência reais, nem pacote, instalação, commit ou push nesta revisão. A compatibilidade do schema com inferência autenticada continua não verificada.
