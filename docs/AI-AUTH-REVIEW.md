# Revisão de integração Codex — 2026-10-27

Notas para a implementação em andamento, verificadas pela revisão Terra independente.

- Usar app-server JSONL por stdio no processo principal. Handshake initialize/initialized; account/login/start type chatgpt; cancel por account/login/cancel; logout por account/logout. Codex gerencia refresh.
- CODEX_HOME exclusivo do Orquestra. Validar isolamento do armazenamento: keyring pode não ser isolado só pelo diretório. Não acessar credenciais existentes do usuário.
- thread/start e turn/start com outputSchema; aceitar resultado apenas após turn/completed status completed. Parse e validação local obrigatórios. Cancelar por turn/interrupt.
- Entradas documentadas do app-server: texto e imagens; não assumir PDF nativo. Extrair texto/renderizar páginas localmente, preservar referências e sinalizar digitalizações ilegíveis.
- Desabilitar shell_tool, multi_agent, MCP/plugins/busca. approvalPolicy never não desabilita ferramentas; readOnly não significa impedir leitura. Validar sandbox e limitar diretórios, sem afirmar isolamento absoluto não testado.
- Fixar versão/arquitetura do runtime e verificar componentes Windows. Não assumir que copiar um único executável basta para redistribuição.
- model/list não prova acesso: geração concluída confirma disponibilidade naquela requisição.
- Login gerenciado local não autoriza automaticamente produto comercial/hosted. SIWC tem registro/consentimento e disponibilidade próprios; não inventar client ID ou afirmar elegibilidade comercial.

Fontes oficiais:

- https://learn.chatgpt.com/docs/app-server
- https://learn.chatgpt.com/docs/config-file/config-reference
- https://learn.chatgpt.com/docs/windows/windows-sandbox
- https://developers.openai.com/siwc/token-sharing-open-source
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

Esta revisão não iniciou login, inferência ou acesso a credenciais reais.

## Rodada 2: configuração comprovada no CLI 0.164.0

A revisão read-only aceitou em strict-config/startup-config, com CODEX_HOME temporário vazio:

```powershell
codex app-server --strict-config --disable shell_tool --disable multi_agent --disable apps --disable plugins -c 'web_search="disabled"' --stdio
```

- thread/start: cwd temporário vazio, sandbox `read-only`, approvalPolicy `never`, ephemeral true.
- turn/start: sandboxPolicy `{type:"readOnly",networkAccess:false}`, outputSchema, cwd vazio.
- Schema local não tem `readOnly.access`; não enviar como se suportado. Não há allowlist geral de ferramentas. tools.disable_defaults é inválido; unified_exec false não é garantia.
- Invalidar saída e interromper ao observar commandExecution/fileChange/mcpToolCall/dynamicToolCall/webSearch/imageView/colaboração; recusar solicitações de aprovação com decision decline e nunca conceder permissões.
- Detecção não é bloqueio preventivo; documentar limite, sem alegar zero leitura fora cwd. Não paralisar o fluxo por ausência de garantia absoluta não solicitada.
- Nenhum login ou inferência foi realizado. Schemas para consulta: C:/Users/KAU~1/AppData/Local/Temp/codex-schema-98782076-1b60-45ad-a108-536b7bd9c05f.
