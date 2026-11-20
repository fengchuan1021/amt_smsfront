<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import type { DealerProject } from '@/types';

const toast = useToast();
const projects = ref<DealerProject[]>([]);
const search = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const dialogVisible = ref(false);
const submitting = ref(false);
const editing = ref<DealerProject | null>(null);
const form = ref({ status: 1, price: 0 });

const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return projects.value;
  return projects.value.filter(
    (item) => `${item.name} ${item.description || ''}`.toLowerCase().includes(q),
  );
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const data = await request<{ items: DealerProject[] }>('/dealer/projects?page_size=100');
    projects.value = data.items;
  } catch (err) {
    const message = err instanceof Error ? err.message : '请稍后重试';
    error.value = message;
    toast.add({ severity: 'error', summary: '加载失败', detail: message, life: 3000 });
  } finally {
    loading.value = false;
  }
}

function openSettings(item: DealerProject): void {
  editing.value = item;
  form.value = { status: item.status, price: item.price };
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  if (!editing.value) return;
  submitting.value = true;
  try {
    await request(`/dealer/projects/${editing.value.project_id}`, {
      method: 'PATCH',
      body: { status: form.value.status, price: form.value.price },
    });
    toast.add({ severity: 'success', summary: '已保存', detail: '项目设置已更新', life: 2000 });
    dialogVisible.value = false;
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '保存失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 },
];

onMounted(load);
</script>

<template>
  <Card>
    <template #content>
      <InputText v-model="search" class="w-full sm:max-w-sm" placeholder="搜索项目名称或说明" />
    </template>
  </Card>

  <div v-if="loading" class="mt-5 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">加载中…</div>
  <div v-else-if="error" class="mt-5 rounded-2xl border border-red-200 bg-white py-16 text-center">
    <i class="pi pi-exclamation-circle text-4xl text-red-300" />
    <p class="mt-3 font-semibold text-slate-700">加载失败</p>
    <p class="mt-1 text-sm text-slate-400">{{ error }}</p>
    <Button label="重试" icon="pi pi-refresh" severity="secondary" outlined size="small" class="mt-4" @click="load" />
  </div>
  <div v-else-if="filteredProjects.length === 0" class="mt-5 rounded-2xl border border-slate-200 bg-white py-16 text-center">
    <i class="pi pi-folder-open text-4xl text-slate-300" />
    <p class="mt-3 font-semibold text-slate-700">暂无项目</p>
    <p class="mt-1 text-sm text-slate-400">管理员还未创建可用的项目</p>
  </div>
  <div v-else class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    <article
      v-for="item in filteredProjects"
      :key="item.id"
      class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-base font-bold text-slate-900">{{ item.name }}</h3>
          <p class="mt-0.5 text-xs text-slate-400">ID {{ item.id }}</p>
        </div>
        <Tag :value="item.status === 1 ? '启用' : '停用'" :severity="item.status === 1 ? 'success' : 'secondary'" />
      </div>
      <p class="line-clamp-2 min-h-[40px] text-sm text-slate-500">{{ item.description || '暂无说明' }}</p>
      <div class="mt-auto flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
        <div class="text-sm font-extrabold text-indigo-600">{{ item.price }} <span class="text-xs font-semibold text-slate-400">积分/次</span></div>
        <Button label="设置" icon="pi pi-cog" size="small" outlined @click="openSettings(item)" />
      </div>
    </article>
  </div>

  <Dialog v-model:visible="dialogVisible" modal :header="`设置 - ${editing?.name || ''}`" :style="{ width: 'min(92vw, 420px)' }">
    <form class="space-y-4" @submit.prevent="save">
      <div>
        <label class="mb-2 block text-xs font-bold text-slate-500">状态</label>
        <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" :show-clear="false" class="w-full" />
      </div>
      <div>
        <label class="mb-2 block text-xs font-bold text-slate-500">单价（积分/次）</label>
        <InputNumber v-model="form.price" class="w-full" :min="0" :max="1000000" :use-grouping="false" input-class="w-full" />
        <p class="mt-1 text-xs text-slate-400">留空或设为 0 表示使用项目默认单价</p>
      </div>
      <div class="flex justify-end gap-2 pt-2"><Button label="取消" severity="secondary" text type="button" @click="dialogVisible = false" /><Button :label="`${editing?.override_id ? '更新' : '设置'}`" type="submit" :loading="submitting" /></div>
    </form>
  </Dialog>
</template>
