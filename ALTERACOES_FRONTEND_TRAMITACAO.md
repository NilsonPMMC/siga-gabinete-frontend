# ✅ Alterações no Frontend - Tramitação Obrigatória

## 📋 Resumo das Alterações

Implementação completa do frontend para suportar o novo fluxo de alteração de status via tramitação obrigatória, com integração à API Sinapse para encaminhamentos.

## 🎯 Arquivos Criados/Modificados

### ✅ Criados:

1. **`src/services/sinapse.js`**
   - Serviço para buscar secretarias da API Sinapse
   - Função `buscarSecretarias()` - Busca lista completa
   - Função `formatarSecretariasParaDropdown()` - Formata para uso em dropdowns

2. **`src/components/atendimentos/AlterarStatusModal.vue`**
   - Modal completo para alteração de status
   - Campos: Novo Status, Despacho (obrigatório), Encaminhamento (se ENCAMINHADO), Notificar Munícipe
   - Validações integradas
   - Integração com endpoint `/api/atendimentos/<pk>/alterar-status/`

### ✅ Modificados:

1. **`src/views/AtendimentoDetailView.vue`**
   - ❌ **Removido**: Dropdown de status do formulário de edição
   - ✅ **Adicionado**: Botão "Alterar Status" ao lado do status (visualização)
   - ✅ **Adicionado**: Import e uso do componente `AlterarStatusModal`
   - ✅ **Modificado**: Função `salvarAlteracoes()` - Removido campo `status` do payload
   - ✅ **Adicionado**: Função `carregarAtendimento()` para recarregar dados após alteração
   - ✅ **Adicionado**: Função `aoStatusAlterado()` - Callback quando status é alterado
   - ✅ **Melhorado**: Timeline de tramitações agora mostra mudanças de status visualmente

## 🔄 Fluxo de Uso

### Antes:
```
Usuário → Seleciona status no dropdown → Clica "Salvar Alterações" → Status alterado
```

### Depois:
```
Usuário → Clica ícone de edição ao lado do status → Modal abre:
         - Seleciona novo status
         - Preenche despacho (obrigatório)
         - Se ENCAMINHADO: Seleciona secretaria da Sinapse
         - Opcional: Marca "Notificar Munícipe"
         → Clica "Alterar Status"
         ↓
         Sistema valida e cria tramitação automaticamente
         ↓
         Status é atualizado
         ↓
         Modal fecha e dados são recarregados
         ↓
         Timeline mostra a mudança de status visualmente
```

## 📊 Funcionalidades Implementadas

### 1. Modal de Alterar Status

**Componente:** `AlterarStatusModal.vue`

**Campos:**
- ✅ Status Atual (somente visualização)
- ✅ Novo Status (dropdown obrigatório)
- ✅ Despacho/Nota de Progresso (textarea obrigatório)
- ✅ Encaminhamento (dropdown obrigatório se status=ENCAMINHADO)
- ✅ Notificar Munícipe (checkbox opcional)

**Validações:**
- ✅ Novo status deve ser diferente do atual
- ✅ Despacho não pode estar vazio
- ✅ Se ENCAMINHADO, deve selecionar secretaria
- ✅ Mensagens de erro claras

**Integração:**
- ✅ Busca secretarias da API Sinapse automaticamente
- ✅ Formata dados para dropdown
- ✅ Envia requisição para `/api/atendimentos/<pk>/alterar-status/`
- ✅ Recarrega dados após sucesso

### 2. Visualização de Status

**Em `AtendimentoDetailView.vue`:**
- ✅ Status exibido como Tag (somente leitura)
- ✅ Botão de edição ao lado do status
- ✅ Tooltip explicativo

### 3. Timeline de Tramitações

**Melhorias:**
- ✅ Mostra mudanças de status visualmente
- ✅ Exibe transição: "Status: Anterior → Novo"
- ✅ Mostra destino de encaminhamento quando aplicável
- ✅ Mantém funcionalidades existentes (editar, excluir)

## 🎨 Componentes PrimeVue Utilizados

- `Dialog` - Modal principal
- `Dropdown` - Seleção de status e secretarias
- `Textarea` - Campo de despacho
- `Checkbox` - Notificar munícipe
- `Tag` - Exibição de status
- `Button` - Ações
- `Timeline` - Histórico de tramitações

## 📝 Endpoints Utilizados

1. **`GET /api/sinapse/secretarias/`**
   - Busca lista de secretarias/órgãos
   - Usado no modal para preencher dropdown de encaminhamento

2. **`POST /api/atendimentos/<pk>/alterar-status/`**
   - Altera status do atendimento via tramitação
   - Payload:
     ```json
     {
       "status_novo": "ENCAMINHADO",
       "despacho": "Texto do despacho...",
       "encaminhado_para_sinapse_id": 123,
       "encaminhado_para_nome": "Secretaria de Educação",
       "encaminhado_para_tipo": "Secretaria",
       "notificar_municipe": true
     }
     ```

3. **`GET /api/atendimentos/<pk>/`**
   - Recarrega dados do atendimento após alteração
   - Retorna tramitações atualizadas com novos campos

## ⚠️ Observações Importantes

1. **Status Read-Only**: O campo `status` foi removido do formulário de edição. Agora só pode ser alterado via modal.

2. **Categorias**: Continuam sendo editáveis normalmente no formulário lateral.

3. **Tramitações Simples**: A funcionalidade de adicionar tramitações simples (sem mudança de status) continua funcionando normalmente.

4. **Backward Compatibility**: Tramitações antigas (sem campos de status) continuam sendo exibidas normalmente.

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar cache local de secretarias (localStorage) para melhor performance
- [ ] Adicionar filtro de busca no dropdown de secretarias
- [ ] Melhorar visualização de mudanças de status na timeline
- [ ] Adicionar confirmação antes de alterar status críticos (ex: CONCLUIDO → ABERTO)

---

**Data de Implementação**: 10/02/2026  
**Status**: ✅ Completo
