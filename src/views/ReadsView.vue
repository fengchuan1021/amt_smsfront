<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { Paged, SmsRead } from '@/types';

const toast = useToast();
const items = ref<SmsRead[]>([]);
const loading = ref(true);

async function load(): Promise<void> {
  try {
    const data = await request<Paged<SmsRead>>('/sms/reads?page_size=100');
    items.value = data.items;
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
    <template #title>我的消费记录</template>
    <template #content>
      <div v-if="loading" class="py-12 text-center text-sm text-slate-400">加载中…</div>
      <div v-else-if="!items.length" class="py-14 text-center"><i class="pi pi-receipt text-4xl text-slate-300" /><p class="mt-3 font-semibold text-slate-700">暂无消费记录</p><p class="mt-1 text-sm text-slate-400">去「读取短信」读取一条短信试试</p></div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-4 py-3">读取时间</th><th class="px-4 py-3">项目</th><th class="px-4 py-3">手机号</th><th class="px-4 py-3">短信内容</th><th class="px-4 py-3">消耗积分</th></tr></thead>
          <tbody class="divide-y divide-slate-100"><tr v-for="item in items" :key="item.id" class="hover:bg-slate-50"><td class="whitespace-nowrap px-4 py-4 text-slate-500">{{ fmtDate(item.created_at) }}</td><td class="px-4 py-4"><Tag :value="item.project_name || `#${item.project_id}`" severity="info" /></td><td class="px-4 py-4 font-mono font-semibold">{{ item.phone }}</td><td class="max-w-[320px] truncate px-4 py-4 text-slate-600" :title="item.content">{{ item.content }}</td><td class="px-4 py-4 font-semibold">{{ item.points }}</td></tr></tbody>
        </table>
      </div>
    </template>
  </Card>
</template>
