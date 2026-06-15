<template>
  <div class="page-container">
    <Toast />
    <header class="page-header">
      <h1>Geração de Etiquetas e Envelopes</h1>
    </header>

    <div class="flex justify-content-center mb-4">
        <SelectButton v-model="modoImpressao" :options="opcoesModo" optionLabel="label" optionValue="value" />
    </div>

    <Card class="mb-4" v-if="modoImpressao === 'MALA_DIRETA'">
        <template #title>
            Passo 1: Selecione os Contatos
        </template>
        <template #content>
            <div class="grid formgrid p-fluid align-items-end gap-2 mb-4">
                
                <div class="field col-12 md:col-6">
                    <label for="filtroContatos">Buscar por Nome, CPF, Email...</label>
                    <InputText id="filtroContatos" v-model="buscaContatos" @keyup.enter="fetchContatos" placeholder="Digite para buscar..." />
                </div>

                <div class="field col-12 md:col-3">
                    <label for="filtroCategoria">Filtrar por Categoria</label>
                    <Dropdown 
                        id="filtroCategoria" 
                        v-model="categoriaSelecionada" 
                        :options="categorias" 
                        optionLabel="nome" 
                        optionValue="id" 
                        showClear 
                        placeholder="Todas as Categorias"
                        @change="fetchContatos"
                    />
                </div>

                <div class="field col-fixed flex gap-2">
                    <Button label="Buscar" icon="pi pi-search" @click="fetchContatos" :loading="isLoading" />
                </div>
            </div>

            <DataTable 
                :value="contatos" 
                :loading="isLoading" 
                responsiveLayout="scroll"
                v-model:selection="contatosSelecionados"
                dataKey="id"
                paginator :rows="20" :rowsPerPageOptions="[10,20,50,100,200]"
                paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords}"
            >
                <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
                <Column field="nome_completo" header="Nome" sortable></Column>
                <Column header="Categoria" sortable>
                    <template #body="{ data }">{{ Array.isArray(data.categorias_nomes) ? data.categorias_nomes.join(', ') : (data.categoria_nome || '') }}</template>
                </Column>
                <Column header="Cargo(s) / Órgão(s)">
                    <template #body="slotProps">
                        {{ cargoOrgaoPerfilConta(slotProps.data) }}
                    </template>
                </Column>
                <Column header="Ações" style="width: 10rem">
                    <template #body="slotProps">
                        <Button
                            v-if="!normalizarTextoEtiqueta(slotProps.data.dados_etiqueta)"
                            label="Gerar padrão"
                            icon="pi pi-magic"
                            class="p-button-text p-button-sm p-button-success"
                            @click="gerarEtiquetaPadrao(slotProps.data)"
                        />
                        <Tag v-else severity="success" value="Etiqueta OK" />
                    </template>
                </Column>
                
                <template #empty>Nenhum contato encontrado.</template>
            </DataTable>
        </template>
    </Card>

    <Card class="mb-4" v-if="podeMostrarConfiguracao">
      <template #title>Passo 2: Configuração de Impressão</template>
      <template #content>
        
        <div v-if="modoImpressao === 'MALA_DIRETA'" class="mb-4">
            <div class="flex justify-content-between align-items-center">
                <h4>Contatos Selecionados: {{ contatosSelecionados.length }}</h4>
                <div class="flex gap-2">
                    <Button
                        label="Editar Modelo"
                        icon="pi pi-file-edit"
                        class="p-button-text p-button-sm p-button-secondary"
                        @click="abrirModalModeloEtiqueta"
                    />
                    <Button
                        label="Gerar Padrão em Lote"
                        icon="pi pi-magic"
                        class="p-button-text p-button-sm p-button-success"
                        @click="gerarEtiquetaPadraoEmLote"
                        :loading="isGeneratingBatchLabels"
                        :disabled="contatosSelecionados.length === 0"
                    />
                    <Button
                        label="Exportar CSV"
                        icon="pi pi-file-excel"
                        class="p-button-text p-button-sm p-button-success"
                        @click="exportarCsvSelecionados"
                        :disabled="contatosSelecionados.length === 0"
                    />
                    <Button
                        label="Importar CSV"
                        icon="pi pi-upload"
                        class="p-button-text p-button-sm p-button-help"
                        @click="abrirSeletorImportacao"
                        :loading="isImportingCsv"
                    />
                    <Button
                        label="Remover Selecionados"
                        icon="pi pi-minus-circle"
                        class="p-button-text p-button-sm p-button-warning"
                        @click="removerSelecionadosParcial"
                        :disabled="selecionadosParaRemocao.length === 0"
                    />
                    <Button label="Limpar Seleção" icon="pi pi-times" class="p-button-text p-button-sm p-button-danger" @click="limparSelecaoTotal" v-if="contatosSelecionados.length > 0" />
                </div>
            </div>
            <input
                ref="inputImportCsvRef"
                type="file"
                accept=".csv,text/csv"
                style="display: none;"
                @change="onImportCsvChange"
            />
            
            <DataTable
                :value="contatosSelecionados"
                v-model:selection="selecionadosParaRemocao"
                dataKey="id"
                responsiveLayout="scroll"
                scrollHeight="300px"
                scrollable
                class="p-datatable-sm"
            >
                <Column selectionMode="multiple" headerStyle="width: 3em"></Column>
                <Column field="nome_completo" header="Nome"></Column>
                <Column field="dados_etiqueta" header="Texto da Etiqueta">
                    <template #body="slotProps">
                    <div v-if="normalizarTextoEtiqueta(slotProps.data.dados_etiqueta)" style="white-space: pre-wrap; font-size: 0.9em;">{{ normalizarTextoEtiqueta(slotProps.data.dados_etiqueta) }}</div>
                    <Button
                        v-else
                        label="Gerar padrão"
                        icon="pi pi-magic"
                        class="p-button-text p-button-sm p-button-success"
                        @click="gerarEtiquetaPadrao(slotProps.data)"
                    />
                    </template>
                </Column>
                <Column header="Ações" style="width: 8rem">
                    <template #body="slotProps">
                    <div class="flex gap-1">
                        <Button
                            v-if="!normalizarTextoEtiqueta(slotProps.data.dados_etiqueta)"
                            label="Gerar padrão"
                            icon="pi pi-magic"
                            class="p-button-text p-button-sm p-button-success"
                            @click="gerarEtiquetaPadrao(slotProps.data)"
                            v-tooltip.top="'Gerar etiqueta padrão com dados do cadastro'"
                        />
                        <Button icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-sm" @click="abrirModalEdicao(slotProps.data)" v-tooltip.top="'Editar texto da etiqueta'" />
                    </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <Divider />

        <div class="grid p-fluid mt-4">
          <div class="field col-12 md:col-6">
            <label for="templateSelect">Modelo de Folha / Envelope</label>
            <Dropdown id="templateSelect" v-model="templateId" :options="templates" optionLabel="nome" optionValue="id" placeholder="Escolha um modelo..." />
          </div>

          <div class="field col-12 md:col-3" v-if="modoImpressao === 'MALA_DIRETA'">
            <label for="posicaoInicial">Posição de Início</label>
            <InputNumber id="posicaoInicial" v-model="posicaoInicial" :min="1" tooltip="Para folhas de etiquetas parcialmente usadas" />
          </div>

          <div class="field col-12 md:col-3" v-if="modoImpressao === 'ESTOQUE'">
            <label for="qtdEstoque">Quantidade de Cópias</label>
            <InputNumber id="qtdEstoque" v-model="quantidadeEstoque" :min="1" showButtons />
          </div>

          <div class="field col-12 md:col-3 mt-4">
             <div class="field-checkbox h-full flex align-items-center">
                <Checkbox v-model="imprimirRemetente" :binary="true" inputId="checkRemetente" />
                <label for="checkRemetente" class="ml-2 cursor-pointer">Imprimir Remetente?</label>
             </div>
          </div>
        </div>

      </template>
      <template #footer>
        <div class="flex justify-content-end">
          <Button 
            :label="labelBotaoGerar" 
            icon="pi pi-print" 
            @click="handleGerarEtiquetas" 
            :loading="isGenerating" 
            :disabled="!templateId" 
            severity="success"
          />
        </div>
      </template>
    </Card>

    <Dialog v-model:visible="modalVisivel" :style="{width: '500px'}" header="Personalizar Texto da Etiqueta" :modal="true" class="p-fluid">
      <div v-if="contatoEmEdicao">
        <p><strong>Contato:</strong> {{ contatoEmEdicao.nome_completo }}</p>
        <div class="field">
          <label for="texto-etiqueta">Texto para a etiqueta:</label>
          <Textarea id="texto-etiqueta" v-model="contatoEmEdicao.dados_etiqueta" rows="5" />
          <small>Use quebras de linha (Enter) para formatar.</small>
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" icon="pi pi-times" text @click="modalVisivel = false" />
        <Button label="Salvar" icon="pi pi-check" @click="salvarDadosEtiqueta" :loading="isSaving" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="modalModeloEtiquetaVisivel"
      :style="{ width: '640px' }"
      header="Modelo de Etiqueta (Padrão)"
      :modal="true"
      class="p-fluid"
    >
      <div class="field">
        <label for="modelo-etiqueta">Template editável</label>
        <Textarea
          id="modelo-etiqueta"
          v-model="modeloEtiquetaDraft"
          rows="8"
        />
        <small>
          Placeholders disponíveis:
          <code>{tratamento}</code>,
          <code>{nome}</code>,
          <code>{instituicao}</code>,
          <code>{cargo_orgao}</code>,
          <code>{endereco_l1}</code>,
          <code>{endereco_l2}</code>.
          Linhas vazias são removidas automaticamente.
        </small>
      </div>
      <div class="field mt-3">
        <label for="preview-modelo">Prévia (primeiro selecionado)</label>
        <Textarea id="preview-modelo" :modelValue="previewModeloEtiqueta" rows="6" readonly />
      </div>
      <template #footer>
        <Button label="Restaurar Padrão" icon="pi pi-refresh" text @click="restaurarModeloEtiquetaPadrao" />
        <Button label="Cancelar" icon="pi pi-times" text @click="modalModeloEtiquetaVisivel = false" />
        <Button label="Aplicar Modelo" icon="pi pi-check" @click="aplicarModeloEtiqueta" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from "primevue/usetoast";
import apiClient from '@/api';
import { useAuthStore } from '@/stores/auth';
// Imports de serviços
import { getMunicipesPaginado, formatarPerfis } from '@/services/comum';
import contatosService from '@/services/contatos'; // Importamos o serviço de contatos para pegar categorias
import { fetchEtiquetaTemplates, gerarEtiquetas, importarDadosEtiquetaCSV } from '@/services/etiquetas';

// Import componentes PrimeVue caso necessário localmente
import Checkbox from 'primevue/checkbox'; 

const toast = useToast();
const authStore = useAuthStore();
const isLoading = ref(false);
const isGenerating = ref(false);
const isSaving = ref(false);
const isImportingCsv = ref(false);
const isGeneratingBatchLabels = ref(false);

// ESTADOS GERAIS
const modoImpressao = ref('MALA_DIRETA');
const imprimirRemetente = ref(false);
const quantidadeEstoque = ref(10);

const opcoesModo = [
    { label: 'Mala Direta (Com Destinatário)', value: 'MALA_DIRETA' },
    { label: 'Estoque / Avulso (Só Remetente)', value: 'ESTOQUE' }
];

// DADOS
const buscaContatos = ref('');
const categorias = ref([]); // Lista de categorias para o dropdown
const categoriaSelecionada = ref(null); // ID da categoria selecionada

const contatos = ref([]);
const contatosSelecionados = ref([]);
const selecionadosParaRemocao = ref([]);
const templates = ref([]);
const templateId = ref(null);
const posicaoInicial = ref(1);

const modalVisivel = ref(false);
const contatoEmEdicao = ref(null);
const contasUsuarioIds = computed(() => new Set(authStore.userContas || []));
const inputImportCsvRef = ref(null);
const contatoPreviewModelo = ref(null);
const MODELO_ETIQUETA_PADRAO = `{tratamento} {nome}
{instituicao}
{endereco_l1}
{endereco_l2}`;
const modeloEtiqueta = ref(MODELO_ETIQUETA_PADRAO);
const modeloEtiquetaDraft = ref(MODELO_ETIQUETA_PADRAO);
const modalModeloEtiquetaVisivel = ref(false);

const podeMostrarConfiguracao = computed(() => {
    if (modoImpressao.value === 'ESTOQUE') return true;
    return contatosSelecionados.value.length > 0;
});

const labelBotaoGerar = computed(() => {
    if (modoImpressao.value === 'ESTOQUE') return 'Gerar Envelopes/Etiquetas Vazias';
    return `Gerar ${contatosSelecionados.value.length} Etiquetas`;
});

const perfisDaContaDoUsuario = (contato) => {
    const perfis = Array.isArray(contato?.perfis) ? contato.perfis : [];
    if (authStore.isSuperuser) return perfis;
    const ids = contasUsuarioIds.value;
    return perfis.filter((p) => ids.has(p?.conta?.id ?? p?.conta));
};

const cargoOrgaoPerfilConta = (contato) => {
    return formatarPerfis(perfisDaContaDoUsuario(contato), contato?.cargo, contato?.orgao) || '—';
};

const cargoOrgaoLinhaEtiqueta = (contato) => {
    const perfis = perfisDaContaDoUsuario(contato);
    if (perfis.length > 0) {
        const p = perfis[0];
        const cargo = (p?.cargo || '').trim();
        const orgao = (p?.instituicao || '').trim();
        if (cargo && orgao) return `${cargo} - ${orgao}`;
        return cargo || orgao || '';
    }
    const cargo = (contato?.cargo || '').trim();
    const orgao = (contato?.orgao || '').trim();
    if (cargo && orgao) return `${cargo} - ${orgao}`;
    return cargo || orgao || '';
};

const instituicaoLinhaEtiqueta = (contato) => {
    const perfis = perfisDaContaDoUsuario(contato);
    if (perfis.length > 0) {
        const instituicao = (perfis[0]?.instituicao || '').trim();
        if (instituicao) return instituicao;
    }
    return (contato?.orgao || '').trim();
};

const enderecoLinhasEtiqueta = (contato) => {
    let e = contato?.endereco;

    // Alguns endpoints retornam endereco como string JSON.
    if (typeof e === 'string') {
        const txt = e.trim();
        if (!txt) e = null;
        else {
            try {
                e = JSON.parse(txt);
            } catch {
                // Se for texto puro, trataremos como texto livre.
                e = { texto_livre: txt };
            }
        }
    }

    // Fallback para campos de endereço achatados no objeto do contato.
    if (!e || typeof e !== 'object') {
        const flatL1 = [contato?.logradouro || contato?.rua || '', contato?.numero || ''].filter(Boolean).join(', ').trim();
        const flatL2 = [contato?.bairro || '', contato?.cidade || '', contato?.cep || ''].filter(Boolean).join(', ').trim();
        if (flatL1 || flatL2) return { l1: flatL1, l2: flatL2 };
        return { l1: '', l2: '' };
    }

    const valorEndereco = (...keys) => {
        for (const key of keys) {
            const raw = e?.[key];
            if (raw === null || raw === undefined) continue;
            if (typeof raw === 'object') continue;
            const txt = String(raw).trim();
            if (txt) return txt;
        }
        return '';
    };

    const l1 = [
        valorEndereco('logradouro', 'rua', 'endereco', 'address', 'linha1'),
        valorEndereco('numero', 'n', 'num'),
        valorEndereco('complemento', 'comp'),
    ].filter(Boolean).join(', ').trim();

    const cidadeUf = [
        valorEndereco('cidade', 'municipio', 'localidade', 'cidade_nome'),
        valorEndereco('uf', 'estado', 'sigla_uf'),
    ].filter(Boolean).join('/');

    const l2 = [
        valorEndereco('bairro', 'bairro_nome', 'district'),
        cidadeUf,
        valorEndereco('cep', 'postal_code'),
    ].filter(Boolean).join(', ').trim();
    if (l1 || l2) return { l1, l2 };

    const textoLivre = (
        valorEndereco('texto_livre', 'endereco_completo', 'formatted', 'texto', 'endereco')
    ).trim();
    if (!textoLivre) {
        const flatL1 = [contato?.logradouro || contato?.rua || '', contato?.numero || ''].filter(Boolean).join(', ').trim();
        const flatL2 = [contato?.bairro || '', contato?.cidade || '', contato?.cep || ''].filter(Boolean).join(', ').trim();
        if (flatL1 || flatL2) return { l1: flatL1, l2: flatL2 };
        return { l1: '', l2: '' };
    }
    const idxHifen = textoLivre.indexOf(' - ');
    if (idxHifen > -1) {
        return {
            l1: textoLivre.slice(0, idxHifen).trim(),
            l2: textoLivre.slice(idxHifen + 3).trim(),
        };
    }
    const partes = textoLivre
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return {
        l1: partes[0] || '',
        l2: partes.slice(1).join(' ') || '',
    };
};

const PREPOSICOES_CONJUNCOES = new Set([
    'a', 'as', 'o', 'os',
    'de', 'da', 'das', 'do', 'dos',
    'e', 'em', 'no', 'na', 'nos', 'nas',
    'para', 'por', 'com', 'sem',
]);

const UFS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
    'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
    'SP', 'SE', 'TO',
]);

const SIGLAS_CONHECIDAS = new Set([
    'ALESP', 'SEMIL', 'SGRI', 'SP', 'DF', 'CGE', 'PGE', 'SAP', 'SAA', 'STM',
]);

const isSigla = (original) => {
    const token = String(original || '').replace(/[^A-Za-z0-9]/g, '').trim();
    if (!token) return false;
    if (UFS.has(token)) return true;
    if (SIGLAS_CONHECIDAS.has(token)) return true;
    return false;
};

const capitalizarPalavra = (palavra, original, indicePalavra) => {
    if (!palavra) return palavra;

    // Preserva apenas siglas conhecidas (evita manter nomes em CAIXA ALTA).
    if (isSigla(original)) {
        return String(original || '').trim();
    }

    const lower = palavra.toLowerCase();
    if (indicePalavra > 0 && PREPOSICOES_CONJUNCOES.has(lower)) {
        return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const capitalizarToken = (token, indicePalavra) => {
    // Mantém pontuação de borda.
    const m = token.match(/^([^A-Za-zÀ-ÿ0-9]*)(.*?)([^A-Za-zÀ-ÿ0-9]*)$/);
    if (!m) return token;
    const prefixo = m[1] || '';
    const nucleo = m[2] || '';
    const sufixo = m[3] || '';
    if (!nucleo) return token;

    // Trata compostos com hífen e barra.
    const separador = nucleo.includes('-') ? '-' : (nucleo.includes('/') ? '/' : null);
    if (separador) {
        const partesOriginais = nucleo.split(separador);
        const partes = partesOriginais.map((parte, idx) => capitalizarPalavra(parte, partesOriginais[idx], idx === 0 ? indicePalavra : indicePalavra + 1));
        return `${prefixo}${partes.join(separador)}${sufixo}`;
    }

    return `${prefixo}${capitalizarPalavra(nucleo, nucleo, indicePalavra)}${sufixo}`;
};

const formatarEscritaTradicional = (texto) => {
    const bruto = String(texto || '').trim();
    if (!bruto) return '';
    const tokens = bruto.split(/\s+/);
    return tokens.map((t, idx) => capitalizarToken(t, idx)).join(' ');
};

const renderEtiquetaComTemplate = (templateRaw, contato) => {
    const template = String(templateRaw || '').trim() || MODELO_ETIQUETA_PADRAO;
    const tratamento = (contato?.tratamento || '').trim();
    const nome = (contato?.nome_completo || '').trim();
    const instituicao = instituicaoLinhaEtiqueta(contato);
    const cargoOrgao = cargoOrgaoLinhaEtiqueta(contato);
    const endereco = enderecoLinhasEtiqueta(contato);
    const placeholders = {
        tratamento,
        nome,
        instituicao,
        cargo_orgao: cargoOrgao,
        endereco_l1: endereco.l1,
        endereco_l2: endereco.l2,
    };
    const textoComDados = template.replace(/\{([a-z0-9_]+)\}/gi, (_full, key) => {
        const valor = placeholders[key.toLowerCase()];
        return String(valor || '').trim();
    });
    const linhas = textoComDados
        .split('\n')
        .map((ln) => ln.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map(formatarEscritaTradicional);
    return linhas.join('\n').trim();
};

const montarEtiquetaPadrao = (contato) => {
    return renderEtiquetaComTemplate(modeloEtiqueta.value, contato);
};

const previewModeloEtiqueta = computed(() => {
    const contatoBase = contatoPreviewModelo.value || contatosSelecionados.value[0] || contatos.value[0];
    if (!contatoBase) return '';
    return renderEtiquetaComTemplate(modeloEtiquetaDraft.value, contatoBase);
});

const categoriaContato = (contato) => {
    if (Array.isArray(contato?.categorias_nomes) && contato.categorias_nomes.length > 0) {
        return contato.categorias_nomes.join(', ');
    }
    return contato?.categoria_nome || '—';
};

const textoEtiqueta = (contato) => {
    return normalizarTextoEtiqueta(contato?.dados_etiqueta) || 'Padrão (Endereço)';
};

const normalizarTextoEtiqueta = (rawValue) => {
    if (!rawValue) return '';
    let txt = String(rawValue).trim();
    if (txt.startsWith('[') && txt.endsWith(']')) {
        try {
            const parsed = JSON.parse(txt);
            if (Array.isArray(parsed)) {
                txt = parsed.map((x) => String(x || '').trim()).filter(Boolean).join('\n');
            }
        } catch {
            // ignora parsing inválido e segue com texto original
        }
    }
    txt = txt.replace(/\\n/g, '\n');
    const linhas = txt
        .split('\n')
        .map((ln) => ln.trim())
        .filter(Boolean)
        .map((ln) => ln.replace(/^\[(Tratamento|Nome|Cargo e Órgão|Cargo e Orgao|Endereço linha 1|Endereço linha 2 com CEP\/Cidade\/UF)\]\s*/i, '').trim())
        .filter(Boolean);
    return linhas.join('\n').trim();
};

const csvEscape = (value) => {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
};

const exportarCsvSelecionados = () => {
    if (!contatosSelecionados.value.length) {
        toast.add({ severity: 'warn', summary: 'Atenção', detail: 'Selecione ao menos um contato para exportar.', life: 3000 });
        return;
    }

    const header = ['id', 'nome', 'categoria', 'cargo / orgao (perfil na conta)', 'dados de etiqueta'];
    const linhas = contatosSelecionados.value.map((contato) => [
        contato?.id ?? '',
        contato?.nome_completo || '—',
        categoriaContato(contato),
        cargoOrgaoPerfilConta(contato),
        textoEtiqueta(contato),
    ]);

    const csv = [header, ...linhas].map((row) => row.map(csvEscape).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `etiquetas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const abrirSeletorImportacao = () => {
    if (inputImportCsvRef.value) {
        inputImportCsvRef.value.value = '';
        inputImportCsvRef.value.click();
    }
};

const onImportCsvChange = async (event) => {
    const arquivo = event?.target?.files?.[0];
    if (!arquivo) return;
    isImportingCsv.value = true;
    try {
        const formDataPreview = new FormData();
        formDataPreview.append('arquivo', arquivo);
        const { data: preview } = await importarDadosEtiquetaCSV(formDataPreview, true);

        const idsNaoEncontradosPreview = preview?.ids_nao_encontrados || [];
        const invalidasPreview = preview?.linhas_invalidas_total || 0;
        const atualizadosPreview = preview?.atualizados || 0;

        if (atualizadosPreview === 0) {
            toast.add({
                severity: 'info',
                summary: 'Pré-visualização concluída',
                detail: `Nenhuma alteração necessária. IDs não encontrados: ${idsNaoEncontradosPreview.length} | Linhas inválidas: ${invalidasPreview}`,
                life: 6500,
            });
            return;
        }

        const confirmar = window.confirm(
            `Pré-visualização: ${atualizadosPreview} registro(s) serão atualizados.\n` +
            `IDs não encontrados: ${idsNaoEncontradosPreview.length}\n` +
            `Linhas inválidas: ${invalidasPreview}\n\n` +
            `Deseja aplicar as alterações agora?`
        );
        if (!confirmar) {
            toast.add({
                severity: 'info',
                summary: 'Importação cancelada',
                detail: 'Nenhuma alteração foi aplicada (somente pré-visualização executada).',
                life: 5000,
            });
            return;
        }

        const formDataApply = new FormData();
        formDataApply.append('arquivo', arquivo);
        const { data } = await importarDadosEtiquetaCSV(formDataApply, false);
        const idsNaoEncontrados = data?.ids_nao_encontrados || [];
        const invalidas = data?.linhas_invalidas_total || 0;
        toast.add({
            severity: 'success',
            summary: 'Importação concluída',
            detail: `Atualizados: ${data?.atualizados || 0} | IDs não encontrados: ${idsNaoEncontrados.length} | Linhas inválidas: ${invalidas}`,
            life: 6500,
        });
        await fetchContatos();
    } catch (error) {
        const detail = error?.response?.data?.detail || 'Falha ao importar CSV de etiquetas.';
        toast.add({ severity: 'error', summary: 'Erro', detail, life: 5000 });
    } finally {
        isImportingCsv.value = false;
    }
};

// --- FETCHS ---

const fetchCategorias = async () => {
    try {
        const response = await contatosService.getCategorias();
        categorias.value = response.data;
    } catch (error) {
        console.error("Erro ao carregar categorias", error);
    }
};

const fetchContatos = async () => {
  isLoading.value = true;
  try {
    // Monta os parâmetros de busca
    const params = { 
        q: buscaContatos.value 
    };
    
    // Se tiver categoria selecionada, adiciona ao filtro
    if (categoriaSelecionada.value) {
        params.categoria = categoriaSelecionada.value;
    }

    const response = await getMunicipesPaginado(params);
    contatos.value = response.data.results ? response.data.results : response.data; // Suporte a paginação padrão DRF
    
    // Se a API retornar paginação completa, ajuste aqui conforme seu backend
    // Se seu backend retorna direto a lista, contatos.value = response.data é suficiente.
    // O código acima tenta ser híbrido.
    
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os contatos.', life: 4000 });
  } finally {
    isLoading.value = false;
  }
};

const fetchTemplates = async () => {
  try {
    const response = await fetchEtiquetaTemplates();
    templates.value = response.data;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar os modelos.', life: 4000 });
  }
};

// --- AÇÕES ---

const abrirModalEdicao = (contato) => {
  contatoEmEdicao.value = { ...contato };
  modalVisivel.value = true;
};

const carregarContatoDetalhado = async (contato) => {
    if (!contato?.id) return contato;
    try {
        const response = await apiClient.get(`/api/municipes/${contato.id}/`);
        return response?.data || contato;
    } catch {
        return contato;
    }
};

const abrirModalModeloEtiqueta = async () => {
    modeloEtiquetaDraft.value = modeloEtiqueta.value || MODELO_ETIQUETA_PADRAO;
    const base = contatosSelecionados.value[0] || contatos.value[0] || null;
    contatoPreviewModelo.value = base ? await carregarContatoDetalhado(base) : null;
    modalModeloEtiquetaVisivel.value = true;
};

const restaurarModeloEtiquetaPadrao = () => {
    modeloEtiquetaDraft.value = MODELO_ETIQUETA_PADRAO;
};

const aplicarModeloEtiqueta = () => {
    const draft = String(modeloEtiquetaDraft.value || '').trim();
    if (!draft) {
        toast.add({
            severity: 'warn',
            summary: 'Modelo inválido',
            detail: 'Informe ao menos uma linha no modelo da etiqueta.',
            life: 4000,
        });
        return;
    }
    modeloEtiqueta.value = draft;
    modalModeloEtiquetaVisivel.value = false;
    toast.add({
        severity: 'success',
        summary: 'Modelo atualizado',
        detail: 'O novo modelo será usado na geração individual e em lote.',
        life: 3500,
    });
};

const salvarDadosEtiqueta = async () => {
  isSaving.value = true;
  try {
    const payload = {
      dados_etiqueta: normalizarTextoEtiqueta(contatoEmEdicao.value.dados_etiqueta)
    };
    const response = await apiClient.patch(`/api/municipes/${contatoEmEdicao.value.id}/`, payload);
    
    const index = contatosSelecionados.value.findIndex(c => c.id === response.data.id);
    if (index !== -1) {
      contatosSelecionados.value[index] = response.data;
    }
    
    toast.add({ severity: 'success', summary: 'Sucesso', detail: 'Texto da etiqueta salvo!', life: 3000 });
    modalVisivel.value = false;
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível salvar os dados.', life: 4000 });
  } finally {
    isSaving.value = false;
  }
};

const gerarEtiquetaPadrao = async (contato) => {
    const contatoComDados = await carregarContatoDetalhado(contato);
    const texto = montarEtiquetaPadrao(contatoComDados);
    if (!texto) {
        toast.add({
            severity: 'warn',
            summary: 'Dados insuficientes',
            detail: 'Não há informações suficientes para montar a etiqueta padrão.',
            life: 4000,
        });
        return;
    }
    isSaving.value = true;
    try {
        const payload = { dados_etiqueta: texto };
        const response = await apiClient.patch(`/api/municipes/${contatoComDados.id}/`, payload);
        const atualizado = response.data;

        contatosSelecionados.value = contatosSelecionados.value.map((c) => (c.id === atualizado.id ? atualizado : c));
        contatos.value = contatos.value.map((c) => (c.id === atualizado.id ? atualizado : c));

        toast.add({
            severity: 'success',
            summary: 'Etiqueta gerada',
            detail: 'Etiqueta padrão criada com os dados do cadastro.',
            life: 3000,
        });
    } catch (error) {
        toast.add({
            severity: 'error',
            summary: 'Erro',
            detail: 'Não foi possível gerar a etiqueta padrão.',
            life: 4000,
        });
    } finally {
        isSaving.value = false;
    }
};

const gerarEtiquetaPadraoEmLote = async () => {
    const candidatos = contatosSelecionados.value.filter((c) => !c?.dados_etiqueta);
    if (!candidatos.length) {
        toast.add({
            severity: 'info',
            summary: 'Sem pendências',
            detail: 'Todos os contatos selecionados já possuem texto de etiqueta.',
            life: 3500,
        });
        return;
    }

    isGeneratingBatchLabels.value = true;
    let sucesso = 0;
    let falha = 0;

    try {
        for (const contato of candidatos) {
            const contatoComDados = await carregarContatoDetalhado(contato);
            const texto = montarEtiquetaPadrao(contatoComDados);
            if (!texto) {
                falha += 1;
                continue;
            }
            try {
                const response = await apiClient.patch(`/api/municipes/${contatoComDados.id}/`, {
                    dados_etiqueta: texto,
                });
                const atualizado = response.data;
                contatosSelecionados.value = contatosSelecionados.value.map((c) => (c.id === atualizado.id ? atualizado : c));
                contatos.value = contatos.value.map((c) => (c.id === atualizado.id ? atualizado : c));
                sucesso += 1;
            } catch (e) {
                falha += 1;
            }
        }

        const severity = falha === 0 ? 'success' : sucesso > 0 ? 'warn' : 'error';
        toast.add({
            severity,
            summary: 'Geração em lote concluída',
            detail: `Etiquetas geradas: ${sucesso}. Falhas/sem dados: ${falha}.`,
            life: 5000,
        });
    } finally {
        isGeneratingBatchLabels.value = false;
    }
};

const removerSelecionadosParcial = () => {
    if (!selecionadosParaRemocao.value.length) {
        toast.add({
            severity: 'info',
            summary: 'Nenhum item marcado',
            detail: 'Marque um ou mais contatos para remover da seleção.',
            life: 3000,
        });
        return;
    }
    const ids = new Set(selecionadosParaRemocao.value.map((c) => c.id));
    const antes = contatosSelecionados.value.length;
    contatosSelecionados.value = contatosSelecionados.value.filter((c) => !ids.has(c.id));
    const removidos = antes - contatosSelecionados.value.length;
    selecionadosParaRemocao.value = [];
    toast.add({
        severity: 'success',
        summary: 'Lista atualizada',
        detail: `${removidos} contato(s) removido(s) da seleção.`,
        life: 3000,
    });
};

const limparSelecaoTotal = () => {
    contatosSelecionados.value = [];
    selecionadosParaRemocao.value = [];
};

const handleGerarEtiquetas = async () => {
  isGenerating.value = true;
  try {
    const payload = {
      template_id: templateId.value,
      posicao_inicial: posicaoInicial.value,
      imprimir_remetente: imprimirRemetente.value,
      contatos: [],
      quantidade_avulsa: 0
    };

    if (modoImpressao.value === 'MALA_DIRETA') {
        payload.contatos = JSON.parse(JSON.stringify(contatosSelecionados.value));
    } else {
        payload.quantidade_avulsa = quantidadeEstoque.value;
    }

    const response = await gerarEtiquetas(payload);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(response.data);
        printWindow.document.close();
    } else {
        toast.add({ severity: 'warn', summary: 'Pop-up Bloqueado', detail: 'Permita pop-ups para visualizar a impressão.', life: 4500 });
    }

  } catch (error) {
    console.error(error);
    toast.add({ severity: 'error', summary: 'Erro', detail: 'Ocorreu um erro ao gerar as etiquetas.', life: 4500 });
  } finally {
    isGenerating.value = false;
  }
};

onMounted(() => {
  fetchCategorias(); // Carrega as categorias ao iniciar
  fetchContatos();
  fetchTemplates();
});
</script>

<style scoped>
.page-container { padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
</style>