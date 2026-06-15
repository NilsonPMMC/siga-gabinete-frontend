<template>
  <div class="page-container">
    <Toast />
    <header class="page-header">
      <div>
        <h1 class="mb-0">Saneamento de Dados</h1>
        <p class="mt-1 text-color-secondary">
          Identifique e corrija rapidamente telefones, e-mails e CPFs problemáticos.
        </p>
      </div>
    </header>

    <Card class="mb-3">
      <template #title>Filtros de Qualidade</template>
      <template #content>
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2 align-items-center">
            <span class="flex align-items-center p-input-icon-left flex-1" style="min-width: 240px">
              <InputText
                v-model="buscaGeral"
                placeholder="Nome, CPF, matrícula RH, cargo, categoria ou órgão..."
                class="w-full"
                @keyup.enter="carregarItens"
              />
            </span>
            <Button label="Buscar" icon="pi pi-search" :loading="loading" @click="carregarItens" />
          </div>
          <Divider layout="vertical" />
          <div class="flex flex-wrap gap-3 align-items-center">
            <div class="flex align-items-center gap-2">
              <Checkbox inputId="filtroTel" v-model="filtros" value="telefone_invalido" />
              <label for="filtroTel">
                Telefones Inválidos
                <small>(00000000, 11111111, 99999999, (11) 4798-5000)</small>
              </label>
            </div>
            <div class="flex align-items-center gap-2">
              <Checkbox inputId="filtroEmail" v-model="filtros" value="email_invalido" />
              <label for="filtroEmail">E-mails sem @</label>
            </div>
            <div class="flex align-items-center gap-2">
              <Checkbox inputId="filtroCpf" v-model="filtros" value="cpf_ausente" />
              <label for="filtroCpf">CPF ausente</label>
            </div>
            <Button
              label="Aplicar Filtros"
              icon="pi pi-filter"
              :loading="loading"
              @click="carregarItens"
            />
            <Button
              label="Exportar CSV (filtros atuais)"
              icon="pi pi-download"
              class="p-button-outlined"
              :disabled="!itens.length || loading"
              @click="exportarCsvAtual"
            />
            <Button
              label="Exportar CSV (todos)"
              icon="pi pi-file-export"
              class="p-button-text"
              :loading="exportandoCsvTodos"
              @click="exportarCsvTodos"
            />
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #title>Registros com Problemas</template>
      <template #content>
        <div v-if="loading" class="text-center my-4">
          <ProgressSpinner />
          <p>Carregando itens de saneamento...</p>
        </div>
        <div v-else>
          <DataTable
            :value="itens"
            dataKey="rowKey"
            paginator
            :rows="20"
            responsiveLayout="scroll"
            stripedRows
            size="small"
          >
            <template #empty> Nenhum problema encontrado com os filtros atuais. </template>
            <Column field="nome_completo" header="Nome" sortable></Column>
            <Column field="cargo_orgao" header="Cargo(s) / Órgão(s)"></Column>
            <Column field="problemaLabel" header="Problema"></Column>
            <Column field="valor_atual" header="Valor Atual"></Column>
            <Column header="Correção">
              <template #body="slotProps">
                <InputText
                  v-model="slotProps.data.novo_valor"
                  :placeholder="placeholderParaCampo(slotProps.data)"
                  class="w-full"
                />
              </template>
            </Column>
            <Column header="Ação" style="width: 8rem">
              <template #body="slotProps">
                <Button
                  label="Salvar"
                  icon="pi pi-check"
                  class="p-button-sm"
                  :loading="slotProps.data.saving"
                  @click="salvarItem(slotProps.data)"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '@/api';
import { useToast } from 'primevue/usetoast';

import Card from 'primevue/card';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressSpinner from 'primevue/progressspinner';
import InputText from 'primevue/inputtext';
import Toast from 'primevue/toast';
import Divider from 'primevue/divider';

const toast = useToast();

const filtros = ref(['telefone_invalido', 'email_invalido', 'cpf_ausente']);
const buscaGeral = ref('');
const itens = ref([]);
const loading = ref(false);
const exportandoCsvTodos = ref(false);

const problemaLabelMap = {
  telefone_invalido: 'Telefone Inválido',
  email_invalido: 'E-mail Inválido',
  cpf_ausente: 'CPF Ausente',
};

const carregarItens = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    (filtros.value || []).forEach((p) => params.append('problema', p));
    const q = (buscaGeral.value || '').trim();
    if (q) params.append('q', q);
    const res = await apiClient.get('/api/municipes/saneamento-dados/', { params });
    itens.value = (res.data || []).map((row, idx) => ({
      ...row,
      rowKey: `${row.id}-${row.campo}-${row.problema}-${idx}`,
      problemaLabel: problemaLabelMap[row.problema] || row.problema,
      novo_valor: row.valor_atual || '',
      saving: false,
    }));
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Não foi possível carregar os itens de saneamento.',
      life: 4000,
    });
  } finally {
    loading.value = false;
  }
};

onMounted(carregarItens);

const placeholderParaCampo = (item) => {
  if (item.campo === 'telefones') return 'Novo telefone';
  if (item.campo === 'emails') return 'Novo e-mail';
  if (item.campo === 'cpf') return 'Novo CPF';
  return 'Novo valor';
};

const salvarItem = async (item) => {
  if (!item.novo_valor || !String(item.novo_valor).trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Atenção',
      detail: 'Informe um novo valor antes de salvar.',
      life: 3000,
    });
    return;
  }

  item.saving = true;
  try {
    const payload = {};
    if (item.campo === 'cpf') {
      payload.cpf = item.novo_valor;
    } else if (item.campo === 'telefones') {
      payload.telefones = [{ tipo: 'celular', numero: item.novo_valor }];
    } else if (item.campo === 'emails') {
      payload.emails = [{ tipo: 'principal', email: item.novo_valor }];
    }

    await apiClient.patch(`/api/municipes/${item.id}/`, payload);
    toast.add({
      severity: 'success',
      summary: 'Atualizado',
      detail: 'Registro atualizado com sucesso.',
      life: 3000,
    });

    // Atualiza valor_atual na tabela e limpa o marcador de problema
    item.valor_atual = item.novo_valor;
  } catch (error) {
    const msg = error.response?.data?.detail || error.response?.data?.error || 'Erro ao salvar alteração.';
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: msg,
      life: 4000,
    });
  } finally {
    item.saving = false;
  }
};

const montarCsv = (dados) => {
  const headers = ['ID', 'Nome', 'Cargo/Órgão', 'Problema', 'Campo', 'Valor Atual'];
  const linhas = dados.map((row) => [
    row.id ?? '',
    row.nome_completo ?? '',
    row.cargo_orgao ?? '',
    row.problemaLabel ?? row.problema ?? '',
    row.campo ?? '',
    row.valor_atual ?? '',
  ]);

  const escape = (v) => {
    const s = String(v ?? '');
    if (s.includes('"') || s.includes(';') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csv = [headers, ...linhas]
    .map((linha) => linha.map(escape).join(';'))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dataStr = new Date().toISOString().slice(0, 10);
  link.download = `saneamento_municipes_${dataStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportarCsvAtual = () => {
  if (!itens.value.length) {
    toast.add({
      severity: 'warn',
      summary: 'Sem dados',
      detail: 'Não há registros carregados para exportar.',
      life: 3000,
    });
    return;
  }
  montarCsv(itens.value);
};

const exportarCsvTodos = async () => {
  exportandoCsvTodos.value = true;
  try {
    const res = await apiClient.get('/api/municipes/saneamento-dados/');
    const dados = (res.data || []).map((row) => ({
      ...row,
      problemaLabel: problemaLabelMap[row.problema] || row.problema,
    }));
    if (!dados.length) {
      toast.add({
        severity: 'info',
        summary: 'Sem dados',
        detail: 'Nenhum problema de saneamento encontrado para exportar.',
        life: 3000,
      });
      return;
    }
    montarCsv(dados);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro',
      detail: 'Não foi possível exportar os dados completos de saneamento.',
      life: 4000,
    });
  } finally {
    exportandoCsvTodos.value = false;
  }
};
</script>

<style scoped>
.page-container {
  padding: 2rem;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
</style>

