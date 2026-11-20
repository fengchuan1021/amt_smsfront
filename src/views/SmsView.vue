<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Dropdown from 'primevue/select';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { Paged, Project, Sms } from '@/types';

const toast = useToast();
const projects = ref<Project[]>([]);
const items = ref<Sms[]>([]);
const loading = ref(true);
const selectedProject = ref<number | null>(null);
const phone = ref('');

async function loadProjects(): Promise<void> {
  const data = await request<Paged<Project>>('/projects?page_size=100');
  projects.value = data.items;
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const query = new URLSearchParams({ page_size: '100' });
    if (selectedProject.value) query.set('project_id', String(selectedProject.value));
    if (phone.value.trim()) query.set('phone', phone.value.trim());
    const data = await request<Paged<Sms>>(`/sms?${query.toString()}`);
    items.value = data.items;
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
}

async function init(): Promise<void> {
  try {
    await loadProjects();
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
    loading.value = false;
  }
}

onMounted(init);
</script>

<template>
  <Card>
    <template #content>
      <div class="flex flex-col gap-3 md:flex-row md:items-center">
        <Dropdown v-model="selectedProject" :options="projects" option-label="name" option-value="id" show-clear placeholder="全部项目" class="w-full md:w-56" @change="load" />
        <InputText v-model="phone" class="w-full md:w-64" placeholder="按手机号搜索" @keyup.enter="load" />
        <button class="p-button p-component p-button-secondary" @click="load"><i class="pi pi-search mr-2" />查询</button>
      </div>
    </template>
  </Card>
  <Card class="mt-5">
    <template #content>
      <div v-if="loading" class="py-12 text-center text-sm text-slate-400">加载中…</div>
      <div v-else-if="!items.length" class="py-14 text-center"><i class="pi pi-comments text-4xl text-slate-300" /><p class="mt-3 font-semibold text-slate-700">暂无短信记录</p><p class="mt-1 text-sm text-slate-400">符合条件的短信还没有上报记录</p></div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-4 py-3">上报时间</th><th class="px-4 py-3">项目</th><th class="px-4 py-3">手机号</th><th class="px-4 py-3">短信内容</th><th class="px-4 py-3">卡商</th><th class="px-4 py-3">消费用户</th><th class="px-4 py-3">积分</th></tr></thead>
          <tbody class="divide-y divide-slate-100"><tr v-for="item in items" :key="item.id" class="hover:bg-slate-50"><td class="whitespace-nowrap px-4 py-4 text-slate-500">{{ fmtDate(item.created_at) }}</td><td class="px-4 py-4"><Tag :value="item.project_name || `#${item.project_id}`" severity="info" /></td><td class="px-4 py-4 font-mono font-semibold">{{ item.phone }}</td><td class="max-w-[320px] truncate px-4 py-4 text-slate-600" :title="item.content">{{ item.content }}</td><td class="px-4 py-4 text-slate-500">#{{ item.user_id }}</td><td class="px-4 py-4 text-slate-500">{{ item.consumer_user_id ? `#${item.consumer_user_id}` : '-' }}</td><td class="px-4 py-4 font-semibold">{{ item.consumed_points }}</td></tr></tbody>
        </table>
      </div>
    </template>
  </Card>
</template>
