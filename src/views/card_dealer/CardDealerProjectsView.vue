<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import type { Paged, Project } from '@/types';

const toast = useToast();
const projects = ref<Project[]>([]);
const search = ref('');
const loading = ref(true);

const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return projects.value;
  return projects.value.filter((item) => `${item.name} ${item.description || ''}`.toLowerCase().includes(q));
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await request<Paged<Project>>('/projects?page_size=100');
    projects.value = data.items;
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Card>
    <template #content>
      <InputText v-model="search" class="w-full sm:max-w-sm" placeholder="搜索项目名称或说明" />
    </template>
  </Card>

  <div v-if="loading" class="mt-5 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">加载中…</div>
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
      </div>
    </article>
  </div>
</template>
