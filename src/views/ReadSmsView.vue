<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dropdown from 'primevue/select';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import type { LatestResult, AcquirePhoneResult, Paged, Project, ReleasePhoneResult } from '@/types';

const toast = useToast();
const projects = ref<Project[]>([]);
const projectId = ref<number | null>(null);
const phone = ref('');
const loading = ref(false);

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 300_000;

type PhoneStatus = 'idle' | 'polling' | 'done' | 'timeout' | 'error';

interface PhoneEntry {
  id: string;
  phone: string;
  projectId: number;
  recordId: number | null;
  status: PhoneStatus;
  result: LatestResult | null;
  error: string | null;
  timer: ReturnType<typeof setInterval> | null;
  startTime: number | null;
}

const acquired = ref<PhoneEntry[]>([]);
let entryCounter = 0;

// 全局时钟，每秒跳动，让剩余倒计时平滑变化
const now = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;

async function init(): Promise<void> {
  try {
    const data = await request<Paged<Project>>('/projects?page_size=100');
    projects.value = data.items;
    projectId.value = data.items[0]?.id ?? null;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '加载项目失败',
      detail: error instanceof Error ? error.message : '请稍后重试',
      life: 3000,
    });
  }
}

async function acquirephone(): Promise<void> {
  if (!projectId.value) {
    toast.add({ severity: 'warn', summary: '请填写完整', detail: '请选择项目', life: 2200 });
    return;
  }
  loading.value = true;
  try {
    const data = await request<AcquirePhoneResult>(
      `/sms/acquirephone?project_id=${projectId.value}&phone=${encodeURIComponent(phone.value.trim())}`
    );

    if (!data.phone) {
      toast.add({ severity: 'error', summary: '获取手机号失败', detail: '服务器未返回手机号，请稍后重试', life: 3200 });
      return;
    }

    const entry = reactive<PhoneEntry>({
      id: String(entryCounter++),
      phone: data.phone,
      projectId: projectId.value,
      recordId:data.occupationRecordId ?? null,
      status: 'polling',
      result: null,
      error: null,
      timer: null,
      startTime: Date.now(),
    });
    acquired.value.push(entry);
    startPolling(entry);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '获取手机号失败',
      detail: error instanceof Error ? error.message : '请稍后重试',
      life: 3200,
    });
  } finally {
    loading.value = false;
  }
}

function startPolling(entry: PhoneEntry) {
  const poll = async () => {
    if (entry.status !== 'polling') return;

    try {
      const data = await request<LatestResult>(
        `/sms/latest?phone=${encodeURIComponent(entry.phone)}&project_id=${entry.projectId}`
      );
      entry.result = data;
      if (data.sms) {
        entry.status = 'done';
        stopPolling(entry);
        return;
      }
    } catch (error) {
      entry.error = error instanceof Error ? error.message : '读取失败';
    }

    if (entry.startTime && Date.now() - entry.startTime >= TIMEOUT_MS) {
      entry.status = 'timeout';
      stopPolling(entry);
    }
  };

  poll();
  entry.timer = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPolling(entry: PhoneEntry) {
  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }
}

async function releaseEntry(id: string) {
  const entry = acquired.value.find((e) => e.id === id);
  if (!entry) return;

  if (entry.recordId) {
    try {
      await request<ReleasePhoneResult>('/sms/releasephone', {
        method: 'POST',
        body: { recordId: entry.recordId },
      });
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: '释放失败',
        detail: error instanceof Error ? error.message : '请稍后重试',
        life: 3000,
      });
      return;
    }
  }

  entry.status = 'idle';
  stopPolling(entry);
} 

async function blockEntry(id: string) {
  const idx = acquired.value.findIndex((e) => e.id === id);
  if (idx === -1) return;
  const entry = acquired.value[idx];

  try {
    await request<{ blocked: boolean }>('/sms/blockphone', {
      method: 'POST',
      body: { projectId: entry.projectId, phone: entry.phone },
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: '拉黑失败',
      detail: error instanceof Error ? error.message : '请稍后重试',
      life: 3000,
    });
    return;
  }

  stopPolling(entry);
  acquired.value.splice(idx, 1);
}

function statusLabel(status: PhoneStatus) {
  const map: Record<PhoneStatus, string> = {
    idle: '已停止',
    polling: '读取中',
    done: '已读取',
    timeout: '已超时',
    error: '错误',
  };
  return map[status];
}

function remainingSeconds(entry: PhoneEntry) {
  if (!entry.startTime) return 0;
  return Math.max(0, Math.floor((TIMEOUT_MS - (now.value - entry.startTime)) / 1000));
}

function startClock() {
  now.value = Date.now();
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

function stopClock() {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
}

onUnmounted(() => {
  stopClock();
  for (const entry of acquired.value) stopPolling(entry);
});

onMounted(() => {
  startClock();
  init();
});
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

    <Card>
      <template #content>
        <form class="space-y-5" @submit.prevent="acquirephone">
          <div class="flex items-center gap-3">
            <label class="w-16 shrink-0 text-xs font-bold text-slate-500">选择项目</label>
            <Dropdown v-model="projectId" :options="projects" option-label="name" option-value="id" placeholder="选择项目" filter filter-placeholder="搜索项目" class="flex-1"><template #option="slotProps"><div class="flex w-full items-center justify-between"><span>{{ slotProps.option.name }}</span><span class="text-xs text-slate-400">{{ slotProps.option.price }} 积分/次</span></div></template></Dropdown>
          </div>
          <div class="flex items-center gap-3">
            <label class="w-16 shrink-0 text-xs font-bold text-slate-500">指定手机号</label>
            <InputText v-model="phone" class="flex-1" placeholder="不指定则随机" />
          </div>
          <Button label="获取号码"  type="submit" class="w-80" :loading="loading" />
     
        </form>
      </template>
    </Card>

    <div v-if="acquired.length === 0" class="py-16 text-center">
      <i class="pi pi-inbox text-5xl text-slate-300" />
      <p class="mt-4 font-semibold text-slate-700">暂无号码</p>
      <p class="mt-1 text-sm text-slate-400">选择项目后点击「获取号码」</p>
    </div>

    <Card v-if="acquired.length > 0">
      <template #content>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-center text-xs font-semibold text-slate-500">
                <th class="pb-3 font-mono text-left">手机号</th>
                <th class="pb-3 font-mono text-left">验证码</th>
                <th class="pb-3 text-left">短信内容</th>
                <th class="pb-3 text-left">错误提示</th>
                <th class="pb-3 text-center">剩余时间</th>
                <!-- <th class="pb-3">状态</th> -->
                <th class="pb-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in acquired" :key="entry.id" class="border-b border-slate-100 last:border-0">
                <td class="py-3 font-mono text-slate-800">{{ entry.phone }}</td>
                <td class="py-3 font-mono text-slate-600">{{ entry.result?.sms?.verifycode || '' }}</td>
                <td class="py-3 whitespace-pre-wrap break-words">{{ entry.result?.sms?.content || '' }}</td>
                <td class="py-3 text-red-600">{{ entry.error || '' }}</td>
                <td class="py-3 text-right text-slate-500">
                  {{ entry.status === 'polling' ? remainingSeconds(entry) + ' 秒' : '-' }}
                </td>
                <!-- <td class="py-3 font-semibold">{{ statusLabel(entry.status) }}</td> -->
                <td class="py-3 flex justify-center gap-1">
                  <Button
                    v-if="entry.status === 'polling'"
                    label="释放"
                    @click="releaseEntry(entry.id)"
                    severity="secondary"
                    outlined
                    size="small"
                  />
                  <Button label="拉黑" @click="blockEntry(entry.id)" severity="danger" outlined size="small" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </Card>
  </div>
</template>
