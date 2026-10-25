# Projetos e Windows — Orquestra 1.1.0

## Resultado

Instalador Windows x64 gerado com NSIS: `release/Orquestra-Setup-1.1.0-x64.exe`. Aplicativo Electron 45.0.0 com renderer isolado, sem acesso direto a Node. Os testes utilizaram perfis temporários exclusivos, preservando a pasta de dados normal do usuário. O instalador foi construído; o assistente de instalação não foi executado. O executável real de `release/win-unpacked` foi aberto e testado.

Captura do executável real: [windows-projects.png](windows-projects.png), inspecionada com `view_image`. A biblioteca segue a identidade existente: verde quase preto, menta, DM Sans, ícones de traço fino, controles compactos, lista de projetos e painel lateral de criação. Preserva a interface e as ferramentas do whiteboard. Não foi gerado um novo conceito de produto: esta é uma extensão da interface existente.

## Verificações

- `npm test`: seis testes passaram, cobrindo migração do quadro anterior; mesclagem com originais intactos e remapeamento de conexões; rejeição de mesclagem inválida ou maior que 200 seções; exclusão do projeto ativo e do último projeto; importação sem substituição; gravação serializada, backup, rejeição de dados inválidos e preservação de arquivo corrompido.
- `npm run dist:win`: TypeScript, Vite, HTML autocontido, compilação compartilhada e instalador NSIS concluídos.
- `node scripts/test-desktop.mjs`: criação pela interface, duas fontes carregadas, gravação em `biblioteca.json`, recarga a partir do disco e fechamento imediatamente após editar. A última edição foi confirmada no arquivo; nenhum erro de console coletado.
- `node scripts/test-packaged.mjs`: teste no `.exe` empacotado, criação de projeto Windows, salvamento e recuperação após recarga. Ponte desktop presente, `window.require` ausente, ambas as fontes carregadas.
- A revisão do primeiro pacote detectou URLs relativas de fontes não substituídas no HTML autocontido. O gerador foi corrigido, o pacote foi reconstruído e os testes passaram exigindo explicitamente fontes carregadas.
- Navegador T3: projeto vazio QA A, exemplo QA B, mesclagem com sete seções; os originais permaneceram; salvar e recarregar manteve o projeto ativo. Duplicação, cancelamento de exclusão e exclusão confirmada foram exercitados. Os projetos de teste foram removidos, mantendo o projeto original.
- Backup da biblioteca gerou JSON; reimportação acrescentou uma cópia, preservando o original. A cópia de teste foi removida. Importação de package.json foi rejeitada sem alterar a biblioteca.
- Responsividade: cabeçalho e controles dentro de 320px; biblioteca sem overflow horizontal e com conteúdo interno rolável. Fluxo desktop revisado em 1440 × 900 e captura do Electron com escala de exibição do Windows.

## Persistência e distribuição

No navegador, a biblioteca usa armazenamento local. No Windows, usa `%APPDATA%\Orquestra\biblioteca.json`; o arquivo anterior é guardado em `.bak`. A biblioteca só é substituída após validação e gravação sincronizada do temporário. Falhas de leitura preservam o arquivo e mostram erro; não iniciam uma biblioteca vazia sobre dados corrompidos. O fechamento normal do app solicita a gravação antes de fechar a janela.

O instalador não é assinado digitalmente: o build não recebeu um certificado. Não há atualização automática ou sincronização entre máquinas. A transferência entre navegador e app usa backup/importação. O assistente instala por usuário e preserva os dados ao desinstalar.
