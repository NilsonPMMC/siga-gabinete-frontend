<template>
  <div class="permission-badge">
    <span
      v-if="iconOnly && accessLevel"
      v-tooltip.top="tooltipText"
      class="permission-icon-only"
      :class="[`permission-icon-only--${accessLevel.severity}`, size]"
      role="img"
      :aria-label="tooltipText"
    >
      <i :class="accessLevel.icon"></i>
    </span>

    <div v-else-if="permissions" class="flex gap-1 flex-wrap">
      <Tag
        v-if="accessLevel"
        :value="accessLevel.label"
        :severity="accessLevel.severity"
        :class="`access-level-tag ${size}`"
      >
        <template #default>
          <i :class="accessLevel.icon" class="mr-1"></i>
          {{ accessLevel.label }}
        </template>
      </Tag>

      <template v-if="showDetails">
        <Tag
          v-for="perm in specificPermissions"
          :key="perm.key"
          :value="perm.label"
          :severity="perm.severity"
          :class="`permission-tag ${size}`"
        >
          <template #default>
            <i :class="perm.icon" class="mr-1"></i>
            {{ perm.label }}
          </template>
        </Tag>
      </template>
    </div>

    <div
      v-if="!iconOnly && showTooltip && permissions"
      class="permission-tooltip mt-2 p-3 surface-ground border-round border-1 border-300"
    >
      <div class="text-sm">
        <h5 class="m-0 mb-2 text-900">Permissões:</h5>
        <div class="grid">
          <div class="col-6">
            <div class="flex align-items-center mb-1">
              <i :class="permissions.pode_visualizar ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" class="mr-2"></i>
              <span>Visualizar</span>
            </div>
            <div class="flex align-items-center mb-1">
              <i :class="permissions.pode_criar ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" class="mr-2"></i>
              <span>Criar</span>
            </div>
          </div>
          <div class="col-6">
            <div class="flex align-items-center mb-1">
              <i :class="permissions.pode_editar ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" class="mr-2"></i>
              <span>Editar</span>
            </div>
            <div class="flex align-items-center mb-1">
              <i :class="permissions.pode_excluir ? 'pi pi-check text-green-500' : 'pi pi-times text-red-500'" class="mr-2"></i>
              <span>Excluir</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  permissions: {
    type: Object,
    default: null,
  },
  size: {
    type: String,
    default: 'normal',
    validator: (value) => ['small', 'normal', 'large'].includes(value),
  },
  showDetails: {
    type: Boolean,
    default: false,
  },
  showTooltip: {
    type: Boolean,
    default: false,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
});

const accessLevel = computed(() => {
  if (!props.permissions) return null;

  const { pode_visualizar, pode_criar, pode_editar, pode_excluir } = props.permissions;

  if (pode_visualizar && pode_criar && pode_editar && pode_excluir) {
    return { label: 'Admin', severity: 'success', icon: 'pi pi-shield' };
  }
  if (pode_visualizar && pode_criar && pode_editar && !pode_excluir) {
    return { label: 'Editor', severity: 'info', icon: 'pi pi-pencil' };
  }
  if (pode_visualizar && pode_criar && !pode_editar && !pode_excluir) {
    return { label: 'Criador', severity: 'warning', icon: 'pi pi-plus' };
  }
  if (pode_visualizar && !pode_criar && !pode_editar && !pode_excluir) {
    return { label: 'Leitor', severity: 'secondary', icon: 'pi pi-eye' };
  }
  if (!pode_visualizar && !pode_criar && !pode_editar && !pode_excluir) {
    return { label: 'Sem Acesso', severity: 'danger', icon: 'pi pi-ban' };
  }
  return { label: 'Custom', severity: 'contrast', icon: 'pi pi-cog' };
});

const specificPermissions = computed(() => {
  if (!props.permissions) return [];

  const perms = [];
  const { pode_visualizar, pode_criar, pode_editar, pode_excluir } = props.permissions;

  if (pode_visualizar) perms.push({ key: 'view', label: 'Ver', severity: 'info', icon: 'pi pi-eye' });
  if (pode_criar) perms.push({ key: 'create', label: 'Criar', severity: 'success', icon: 'pi pi-plus' });
  if (pode_editar) perms.push({ key: 'edit', label: 'Editar', severity: 'warning', icon: 'pi pi-pencil' });
  if (pode_excluir) perms.push({ key: 'delete', label: 'Excluir', severity: 'danger', icon: 'pi pi-trash' });

  return perms;
});

const tooltipText = computed(() => {
  if (!props.permissions || !accessLevel.value) return 'Sem permissões';

  const parts = [];
  const { pode_visualizar, pode_criar, pode_editar, pode_excluir } = props.permissions;
  if (pode_visualizar) parts.push('Visualizar');
  if (pode_criar) parts.push('Criar');
  if (pode_editar) parts.push('Editar');
  if (pode_excluir) parts.push('Excluir');

  return `${accessLevel.value.label}: ${parts.join(', ') || 'Nenhuma'}`;
});
</script>

<style scoped>
.permission-badge {
  display: inline-block;
}

.permission-icon-only {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  cursor: default;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.permission-icon-only.small {
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
}

.permission-icon-only.large {
  width: 2rem;
  height: 2rem;
  font-size: 1rem;
}

.permission-icon-only:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.permission-icon-only--success { background: #10b981; color: #fff; }
.permission-icon-only--info { background: #3b82f6; color: #fff; }
.permission-icon-only--warning { background: #f59e0b; color: #fff; }
.permission-icon-only--secondary { background: #6b7280; color: #fff; }
.permission-icon-only--danger { background: #ef4444; color: #fff; }
.permission-icon-only--contrast { background: #374151; color: #fff; }

.access-level-tag,
.permission-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  transition: all 0.2s ease;
}

.access-level-tag.small,
.permission-tag.small {
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
}

.permission-tooltip {
  min-width: 200px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
