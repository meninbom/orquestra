# Verificação do Orquestra — 25/10/2026

## Referência e comparação visual

O vídeo indicado pelo usuário foi aberto no navegador colaborativo T3. Foram inspecionados os trechos de 45s e 80s: quadro escuro, escrita manual, blocos conectados e roteiro de seções à direita. A referência do vídeo não foi tratada como uma especificação exaustiva de todas as ferramentas disponíveis.

Conceito gerado com a ferramenta integrada de imagens: [concept.png](concept.png). Prompt: editor desktop Orquestra em português, quadro verde quase preto, grid pontilhado, traços claros, acentos menta, ferramentas à esquerda, seis seções à direita, diagrama de orquestrador, pesquisador, desenvolvedor, revisor e entrega, navegação de apresentação no rodapé. Esse conceito orientou a implementação.

Render final: [implementation.png](implementation.png), 1536 × 1024, capturado pelo Chromium do `html_preview` a partir do bundle real e autocontido da aplicação. Animações foram desativadas apenas nessa captura para evitar registrar um estado intermediário. Foram abertos com `view_image` tanto o conceito quanto o render final no mesmo passe de revisão. O navegador colaborativo T3 foi usado para todos os testes de interação. Suas capturas estavam comprimidas, por isso o render adicional foi usado para avaliar tipografia e detalhes.

| Ponto | Verificação e resultado |
|---|---|
| Estrutura | Canvas aberto, toolbar vertical, painel de seções à direita, cabeçalho e controle de cenas inferior preservados. |
| Paleta | Fundo #0c1412 e acento #8fe3b5; agentes em amarelo, azul e lilás; modo claro recebe cores mais escuras para contraste. |
| Tipografia | Caveat variável no diagrama e DM Sans nos controles, servidas localmente; texto do agente quebra em linhas conforme a largura. |
| Geometria e espaço | Orquestrador central acima dos três agentes, convergência para a entrega; escala e posições foram ajustadas após a primeira comparação. |
| Ícones | Lupa, código, revisão e ramificação permanecem vetoriais e escaláveis, com traço consistente. |
| Responsividade | 1536 × 1024, viewport real 1274 × 736, 390 × 844 e 320 × 740. Sem overflow horizontal; controles inferiores separados em 320px. |
| Movimento | Navegação entre seções, revelação em etapas, reprodução automática e fluxo nas setas; preferência de movimento reduzido respeitada. |

Diferenças intencionais em relação à imagem de conceito: logo vetorial próprio, contornos SVG regulares em vez de irregularidades desenhadas pela IA, descrições mais curtas dos agentes, seis títulos de seções específicos sobre orquestração, controles adicionais de edição e metadados de seção no painel. A fonte real Caveat preserva o caráter manuscrito, sem tentar copiar os glifos sintéticos da imagem. Conferência do texto acima da dobra: título do documento, chamada principal, subtítulo, agentes, entrega e ações principais preservados; alterações de nomes e descrições estão listadas aqui. A fidelidade à direção visual foi conferida com essas adaptações explícitas; não é uma reprodução pixel a pixel do vídeo ou da imagem gerada.

## Fluxos executados

- Criar um agente, editar seu texto e confirmar com Ctrl+Enter; desfazer e refazer conferindo o elemento e seu texto.
- Arrastar Pesquisador até Desenvolvedor e desfazer, verificando a alteração da coordenada X.
- Criar um retângulo, duplicar, excluir e desfazer; conferir a contagem de elementos do mundo SVG.
- Conectar Pesquisador a Revisor com uma seta; conferir a geometria resultante `M 360 501 L 780 501`; desfazer.
- Usar desenho livre por arraste; conferir criação de um elemento de desenho e desfazer.
- Criar seção, renomear para Teste de persistência, recarregar e confirmar permanência; excluir a seção de teste.
- Alterar animação e etapa de um elemento pelo painel Estilo; restaurar o quadro por importação do JSON exportado.
- Apresentar: etapa inicial sem agentes, avançar e conferir que apenas o orquestrador aparece na etapa 1; reproduzir automaticamente até as seções seguintes; encerrar com Esc.
- Alternar tema e recarregar; confirmar preferência persistida.
- Mobile: abrir/recolher painel, trocar seção e avançar apresentação; conferir limites dos controles e ausência de overflow.
- Exportar JSON, SVG e PNG, confirmando downloads concluídos; reimportar JSON com seis seções e 12 elementos na primeira seção.
- Tentar importar package.json: arquivo rejeitado e quadro preservado.
- Validar esquema: quadro inicial aceito; null, etapa exagerada, duração negativa e IDs duplicados rejeitados.
- Abrir `dist/orquestra.html` como documento independente servido pelo Vite: 12 elementos, duas fontes carregadas e zero requisições de arquivos de fontes. O arquivo contém todos os recursos necessários; o teste registrado foi via HTTP local.
- Inspecionar o PNG final da visão geral com `view_image`: texto, fontes, conectores, cor de fundo e composição preservados. Medição SVG não encontrou texto mais largo que seus blocos na visão geral.

`npm run build` passou: TypeScript, Vite e geração do HTML autocontido. `html_preview` não reportou mensagens de console no render isolado. Não foi criado backend, serviço de colaboração, integração de execução de agentes ou deployment externo.
