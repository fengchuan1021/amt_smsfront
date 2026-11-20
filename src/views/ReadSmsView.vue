<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dropdown from 'primevue/select';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { setBalance } from '@/stores/auth';
import type { LatestResult, Paged, Project } from '@/types';

const toast = useToast();
const projects = ref<Project[]>([]);
const projectId = ref<number | null>(null);
const phone = ref('');
const loading = ref(false);
const result = ref<LatestResult | null>(null);

async function init(): Promise<void> {
  try {
    const data = await request<Paged<Project>>('/projects?page_size=100');
    projects.value = data.items;
    projectId.value = data.items[0]?.id ?? null;
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载项目失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function readLatest(): Promise<void> {
  if (!projectId.value || !phone.value.trim()) {
    toast.add({ severity: 'warn', summary: '请填写完整', detail: '请选择项目并输入手机号', life: 2200 });
    return;
  }
  loading.value = true;
  result.value = null;
  try {
    const data = await request<LatestResult>(`/sms/latest?project_id=${projectId.value}&phone=${encodeURIComponent(phone.value.trim())}`);
    result.value = data;
    setBalance(data.balance);
  } catch (error) {
    toast.add({ severity: 'error', summary: '读取失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3200 });
  } finally {
    loading.value = false;
  }
}

onMounted(init);
</script>

<template>
  <div class="space-y-5">
    <Card>
      <template #content>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p class="font-bold">使用前请仔细阅读以下提示</p>
          <ol class="mt-2 list-decimal space-y-1 pl-5">
            <li>我们仅提供短信接收服务，新号老号请自行检测，如不适合请勿使用！</li>
            <li>我们不持有号码，号码源自提供商，所以号码随时失效，重要业务切勿绑定。</li>
            <li>部分提供商为了利益最大化会在多个地方上卡，有可能导致账号被盗，请勿绑定重要业务。</li>
            <li>如果您不熟悉或者不会使用，请阅读使用帮助；不会用的情况下不建议使用。</li>
            <li>飞机群：haozhuma（非此 ID 都是仿冒的）</li>
          </ol>
        </div>
      </template>
    </Card>

    <div class="space-y-5">
    <Card>
     
      <template #content>
        <form class="space-y-5" @submit.prevent="readLatest">
          <div><label class="mb-2 block text-xs font-bold text-slate-500">项目</label><Dropdown v-model="projectId" :options="projects" option-label="name" option-value="id" placeholder="选择项目" class="w-full"><template #option="slotProps"><div class="flex w-full items-center justify-between"><span>{{ slotProps.option.name }}</span><span class="text-xs text-slate-400">{{ slotProps.option.price }} 积分/次</span></div></template></Dropdown></div>
          <div><label class="mb-2 block text-xs font-bold text-slate-500">手机号</label><InputText v-model="phone" class="w-full" placeholder="例如 13800000000" /></div>
          <Button label="读取最新一条" icon="pi pi-search" type="submit" class="w-full" :loading="loading" />
          <p class="text-xs leading-5 text-slate-400">同一消费者重复读取同一条短信不会重复扣费，出现新短信时才会再次扣费。</p>
        </form>
      </template>
    </Card>

    <Card v-if="result?.sms" class="">
      <template #title><div class="flex items-center justify-between gap-3"><span>短信详情</span><Tag :value="result.sms.project_name || `项目 ${result.sms.project_id}`" severity="info" /></div></template>
      <template #content>
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 whitespace-pre-wrap break-words">{{ result.sms.content }}</div>
        <div class="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4"><div><div class="text-xs font-semibold text-slate-400">手机号</div><div class="mt-1 font-mono font-semibold">{{ result.sms.phone }}</div></div><div><div class="text-xs font-semibold text-slate-400">上报时间</div><div class="mt-1 font-semibold">{{ fmtDate(result.sms.created_at) }}</div></div><div><div class="text-xs font-semibold text-slate-400">设备标识</div><div class="mt-1 break-all font-mono text-xs">{{ result.sms.device_id || '-' }}</div></div><div><div class="text-xs font-semibold text-slate-400">短信 ID</div><div class="mt-1 font-semibold">#{{ result.sms.id }}</div></div></div>
        <div class="mt-5 rounded-xl px-4 py-3 text-sm font-semibold" :class="result.charged > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'"><i :class="result.charged > 0 ? 'pi pi-check-circle' : 'pi pi-info-circle'" class="mr-2" />{{ result.charged > 0 ? `本次读取扣费 ${result.charged} 积分，当前余额 ${result.balance}` : result.already_read ? `该短信已读取过，本次不重复扣费，当前余额 ${result.balance}` : `本次读取未扣费，当前余额 ${result.balance}` }}</div>
      </template>
    </Card>
    <Card v-else class="xl:col-start-2"><template #content><div class="py-16 text-center"><i class="pi pi-inbox text-5xl text-slate-300" /><p class="mt-4 font-semibold text-slate-700">等待读取</p><p class="mt-1 text-sm text-slate-400">填写手机号并点击「读取最新一条」</p></div></template></Card>
    </div>
  </div>
</template>
