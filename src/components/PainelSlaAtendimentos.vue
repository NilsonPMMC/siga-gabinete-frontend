<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Card from 'primevue/card';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps({
  slaData: {
    type: Object,
    default: null,
  },
});

const SLA_CORES = {
  NO_PRAZO: '#22c55e',
  EM_RISCO: '#f59e0b',
  VENCIDO: '#ef4444',
};

const resumo = computed(() => props.slaData?.resumo ?? null);
const totais = computed(() => resumo.value?.totais ?? {});
const comSla = computed(() => resumo.value?.com_sla ?? 0);
const pctNoPrazo = computed(() => resumo.value?.pct_no_prazo ?? 0);

const chartData = computed(() => {
  const t = totais.value;
  const labels = ['No prazo', 'Em risco', 'Vencido'];
  const values = [t.NO_PRAZO || 0, t.EM_RISCO || 0, t.VENCIDO || 0];
  return {
    labels,
    datasets: [{
      data: values,
      backgroundColor: [SLA_CORES.NO_PRAZO, SLA_CORES.EM_RISCO, SLA_CORES.VENCIDO],
      hoverBackgroundColor: [SLA_CORES.NO_PRAZO, SLA_CORES.EM_RISCO, SLA_CORES.VENCIDO],
    }],
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12 } },
  },
};

const porConta = computed(() => props.slaData?.por_conta ?? []);
const porAssunto = computed(() => props.slaData?.por_assunto ?? []);

function badgeClass(pct) {
  if (pct >= 80) return 'sla-badge sla-badge--ok';
  if (pct >= 50) return 'sla-badge sla-badge--warn';
  return 'sla-badge sla-badge--danger';
}
</script>

<template>
  <section v-if="comSla > 0" class="sla-panel">
    <div class="sla-panel-head">
      <h2><i class="pi pi-stopwatch" /> Cumprimento de SLA</h2>
      <span class="sla-panel-meta">{{ comSla }} atendimento(s) com prazo definido</span>
    </div>

    <div class="sla-kpi-row">
      <div class="sla-kpi sla-kpi--destaque">
        <span class="sla-kpi__valor">{{ pctNoPrazo }}%</span>
        <span class="sla-kpi__label">No prazo (abertos)</span>
      </div>
      <div class="sla-kpi">
        <span class="sla-kpi__valor" :style="{ color: SLA_CORES.NO_PRAZO }">{{ totais.NO_PRAZO || 0 }}</span>
        <span class="sla-kpi__label">No prazo</span>
      </div>
      <div class="sla-kpi">
        <span class="sla-kpi__valor" :style="{ color: SLA_CORES.EM_RISCO }">{{ totais.EM_RISCO || 0 }}</span>
        <span class="sla-kpi__label">Em risco</span>
      </div>
      <div class="sla-kpi">
        <span class="sla-kpi__valor" :style="{ color: SLA_CORES.VENCIDO }">{{ totais.VENCIDO || 0 }}</span>
        <span class="sla-kpi__label">Vencidos</span>
      </div>
    </div>

    <div class="sla-grid">
      <Card class="sla-chart-card">
        <template #title>Distribuição SLA</template>
        <template #content>
          <div class="sla-chart-wrap">
            <Doughnut :data="chartData" :options="chartOptions" />
          </div>
        </template>
      </Card>

      <Card v-if="porConta.length" class="sla-table-card">
        <template #title>Por gabinete</template>
        <template #content>
          <div class="sla-table-scroll">
            <table class="sla-table">
              <thead>
                <tr>
                  <th>Gabinete</th>
                  <th>Total</th>
                  <th>No prazo</th>
                  <th>Em risco</th>
                  <th>Vencido</th>
                  <th>% OK</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in porConta" :key="row.nome">
                  <td>{{ row.nome }}</td>
                  <td>{{ row.total }}</td>
                  <td>{{ row.NO_PRAZO }}</td>
                  <td>{{ row.EM_RISCO }}</td>
                  <td>{{ row.VENCIDO }}</td>
                  <td><span :class="badgeClass(row.pct_no_prazo)">{{ row.pct_no_prazo }}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </Card>

      <Card v-if="porAssunto.length" class="sla-table-card">
        <template #title>Por assunto</template>
        <template #content>
          <div class="sla-table-scroll">
            <table class="sla-table">
              <thead>
                <tr>
                  <th>Assunto</th>
                  <th>Total</th>
                  <th>No prazo</th>
                  <th>Em risco</th>
                  <th>Vencido</th>
                  <th>% OK</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in porAssunto" :key="row.nome">
                  <td>{{ row.nome }}</td>
                  <td>{{ row.total }}</td>
                  <td>{{ row.NO_PRAZO }}</td>
                  <td>{{ row.EM_RISCO }}</td>
                  <td>{{ row.VENCIDO }}</td>
                  <td><span :class="badgeClass(row.pct_no_prazo)">{{ row.pct_no_prazo }}%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </Card>
    </div>
  </section>
</template>

<style scoped>
.sla-panel {
  margin-bottom: 2rem;
}
.sla-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.sla-panel-head h2 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.sla-panel-meta {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}
.sla-kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.sla-kpi {
  padding: 1rem;
  border-radius: 10px;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  text-align: center;
}
.sla-kpi--destaque {
  background: linear-gradient(135deg, #ecfdf5 0%, var(--surface-card) 70%);
  border-color: #bbf7d0;
}
.sla-kpi__valor {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.2;
}
.sla-kpi__label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-color-secondary);
}
.sla-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}
.sla-chart-wrap {
  height: 280px;
  position: relative;
}
.sla-table-scroll {
  overflow-x: auto;
}
.sla-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.sla-table th,
.sla-table td {
  padding: 0.5rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid var(--surface-border);
}
.sla-table th {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text-color-secondary);
}
.sla-badge {
  display: inline-block;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.sla-badge--ok {
  background: #dcfce7;
  color: #166534;
}
.sla-badge--warn {
  background: #fef3c7;
  color: #92400e;
}
.sla-badge--danger {
  background: #fee2e2;
  color: #991b1b;
}
</style>
