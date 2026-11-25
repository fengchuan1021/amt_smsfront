<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import QRCode from 'qrcode';
import { ApiError, request } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { auth, setBalance } from '@/stores/auth';
import type { Paged, RechargeChannel, RechargeOrder } from '@/types';

const CHANNEL_ICON: Record<string, string> = {
  usdt: 'pi pi-wallet',
  wechat: 'pi pi-comments',
  alipay: 'pi pi-credit-card',
  card_site: 'pi pi-shop',
};

const STATUS_LABEL: Record<number, { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }> = {
  0: { label: '待支付', severity: 'warn' },
  1: { label: '已到账', severity: 'success' },
  2: { label: '已过期', severity: 'secondary' },
  3: { label: '失败', severity: 'danger' },
  4: { label: '已取消', severity: 'secondary' },
};

const toast = useToast();
const loading = ref(true);
const submitting = ref(false);
const cancelling = ref(false);
const channels = ref<RechargeChannel[]>([]);
const orders = ref<RechargeOrder[]>([]);
const selectedCode = ref('usdt');
const points = ref(100);
const active = ref<RechargeOrder | null>(null);
const qrUrl = ref('');
const nowTick = ref(Date.now());

let clockTimer = 0;
let pollTimer = 0;

const selected = computed(() => channels.value.find((item) => item.code === selectedCode.value) ?? null);
const enabledChannels = computed(() => channels.value.filter((item) => item.status === 1));

const rateText = computed(() => {
  const channel = selected.value;
  if (!channel || channel.status !== 1) return '';
  if (channel.currency === 'CNY') {
    return `${channel.points_per_currency} 积分 = 1 元，提交后按实时汇率折合 USDT-TRC20`;
  }
  if (channel.currency === 'USD') {
    return `${channel.points_per_currency} 积分 = 1 USDT`;
  }
  return channel.remark || '';
});

const countdown = computed(() => {
  const expiredAt = active.value?.expired_at;
  if (!expiredAt) return '--:--';
  const end = Date.parse(expiredAt.replace(' ', 'T') + 'Z');
  const seconds = Math.max(0, Math.floor((end - nowTick.value) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(remain)}` : `${pad(minutes)}:${pad(remain)}`;
});

watch(
  () => active.value?.pay_address ?? '',
  async (address) => {
    if (!address) {
      qrUrl.value = '';
      return;
    }
    try {
      qrUrl.value = await QRCode.toDataURL(address, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
    } catch {
      qrUrl.value = '';
    }
  },
);

function statusOf(status: number): { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' } {
  return STATUS_LABEL[status] ?? { label: '未知', severity: 'secondary' };
}

function formatUsdt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toFixed(4);
}

function formatAmount(order: RechargeOrder): string {
  if (order.currency === 'CNY') return `${order.amount} 元`;
  if (order.currency === 'USD') return `${order.amount} USDT`;
  return `${order.amount} ${order.currency}`;
}

async function copyText(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.add({ severity: 'success', summary: '已复制', detail: label, life: 1600 });
  } catch {
    toast.add({ severity: 'error', summary: '复制失败', detail: '请手动选择复制', life: 2200 });
  }
}

function stopPolling(): void {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = 0;
}

function startPolling(): void {
  stopPolling();
  if (active.value?.status !== 0) return;
  pollTimer = window.setInterval(() => {
    void refreshActive();
  }, 4000);
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [channelData, orderData] = await Promise.all([
      request<{ items: RechargeChannel[] }>('/recharge/channels'),
      request<Paged<RechargeOrder>>('/recharge/orders?page_size=20'),
    ]);
    channels.value = channelData.items;
    orders.value = orderData.items;
    const current = channels.value.find((item) => item.code === selectedCode.value && item.status === 1);
    const fallback = channels.value.find((item) => item.status === 1);
    selectedCode.value = current?.code || fallback?.code || channels.value[0]?.code || 'usdt';
    if (fallback) points.value = fallback.presets.includes(points.value) ? points.value : (fallback.presets[0] ?? 100);
    const pending = orders.value.find((item) => item.status === 0);
    if (pending) {
      active.value = pending;
      startPolling();
    }
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
}

async function loadOrders(): Promise<void> {
  const data = await request<Paged<RechargeOrder>>('/recharge/orders?page_size=20');
  orders.value = data.items;
}

async function refreshActive(): Promise<void> {
  if (!active.value) return;
  try {
    const data = await request<{ order: RechargeOrder }>(`/recharge/orders/${active.value.order_no}`);
    const previous = active.value.status;
    active.value = data.order;
    if (data.order.status === 1 && previous !== 1) {
      if (data.order.balance != null) setBalance(data.order.balance);
      toast.add({ severity: 'success', summary: '充值到账', detail: `已增加 ${data.order.points} 积分`, life: 2500 });
      await loadOrders();
    }
    if (data.order.status !== 0) stopPolling();
  } catch {
    /* 轮询失败时保留当前收银台，等待下一次 */
  }
}

async function createOrder(): Promise<void> {
  const channel = selected.value;
  if (!channel || channel.status !== 1) return;
  const value = Number(points.value);
  if (!Number.isInteger(value) || value < channel.min_points || value > channel.max_points) {
    toast.add({
      severity: 'warn',
      summary: '积分数量无效',
      detail: `请输入 ${channel.min_points} 到 ${channel.max_points} 之间的整数`,
      life: 2500,
    });
    return;
  }
  submitting.value = true;
  try {
    const data = await request<{ order: RechargeOrder }>('/recharge/orders', {
      method: 'POST',
      body: { channel_code: channel.code, points: value },
    });
    active.value = data.order;
    startPolling();
    await loadOrders();
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PENDING_ORDER_EXISTS') {
      const order = (error.details as { order?: RechargeOrder } | undefined)?.order;
      if (order) {
        active.value = order;
        startPolling();
      }
    }
    toast.add({ severity: 'error', summary: '创建订单失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3200 });
  } finally {
    submitting.value = false;
  }
}

async function cancelOrder(): Promise<void> {
  if (!active.value || active.value.status !== 0) return;
  cancelling.value = true;
  try {
    await request(`/recharge/orders/${active.value.order_no}/cancel`, { method: 'POST' });
    active.value = null;
    stopPolling();
    toast.add({ severity: 'success', summary: '订单已取消', life: 1800 });
    await loadOrders();
  } catch (error) {
    toast.add({ severity: 'error', summary: '取消失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    cancelling.value = false;
  }
}

function choosePreset(value: number): void {
  points.value = value;
}

function yuanLabel(value: number): string {
  const channel = selected.value;
  if (!channel || channel.currency !== 'CNY' || !(channel.points_per_currency > 0)) return '';
  const yuan = value / channel.points_per_currency;
  const text = Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
  return `${text} 元`;
}

function openOrder(order: RechargeOrder): void {
  if (order.status !== 0) return;
  active.value = order;
  startPolling();
}

onMounted(() => {
  clockTimer = window.setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  void load();
});

onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer);
  stopPolling();
});
</script>

<template>
  <div class="space-y-6">
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">当前积分</div>
        <div class="mt-3 text-4xl font-extrabold tracking-tight text-slate-900">{{ auth.user?.balance ?? 0 }}</div>
        <p class="mt-2 text-sm text-slate-500">充值到账后可用于读取短信。</p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-4 text-sm font-bold text-slate-900">充值渠道</div>
        <div v-if="loading" class="py-8 text-sm text-slate-400">加载中…</div>
        <div v-else class="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <button
            v-for="channel in channels"
            :key="channel.code"
            type="button"
            class="rounded-2xl border px-4 py-4 text-left transition"
            :class="channel.status !== 1
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : selectedCode === channel.code
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200'"
            :disabled="channel.status !== 1"
            @click="selectedCode = channel.code"
          >
            <div class="flex items-center justify-between gap-2">
              <i :class="CHANNEL_ICON[channel.code] || 'pi pi-wallet'" class="text-lg" />
              <Tag :value="channel.status === 1 ? '可用' : '即将开放'" :severity="channel.status === 1 ? 'success' : 'secondary'" />
            </div>
            <div class="mt-3 font-bold">{{ channel.name }}</div>
            <div class="mt-1 text-xs leading-5 text-slate-400">{{ channel.remark || ' ' }}</div>
          </button>
        </div>
      </div>
    </section>

    <section v-if="active" class="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">收银台</div>
          <h2 class="mt-2 text-xl font-extrabold text-slate-900">{{ active.channel_name || 'USDT' }} 充值</h2>
          <p class="mt-1 font-mono text-xs text-slate-400">{{ active.order_no }}</p>
        </div>
        <Tag :value="statusOf(active.status).label" :severity="statusOf(active.status).severity" />
      </div>

      <div v-if="active.status === 0" class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div class="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-4">
          <img v-if="qrUrl" :src="qrUrl" alt="USDT 收款地址二维码" class="h-52 w-52 rounded-xl bg-white p-2" />
          <div v-else class="grid h-52 w-52 place-items-center text-sm text-slate-400">二维码生成中…</div>
          <p class="mt-3 text-center text-xs text-slate-400">扫码仅复制收款地址，金额需手动填写</p>
        </div>
        <div class="space-y-4">
          <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            请使用 TRC20 网络转账下方精确金额。金额不一致时无法自动到账。订单 {{ formatAmount(active) }}，到账 {{ active.points }} 积分。
          </div>
          <div>
            <div class="text-xs font-bold text-slate-400">应付 USDT</div>
            <div class="mt-1 flex flex-wrap items-center gap-3">
              <span class="font-mono text-3xl font-extrabold tracking-tight text-slate-900">{{ formatUsdt(active.actual_amount) }}</span>
              <Button label="复制金额" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyText(formatUsdt(active.actual_amount), '已复制应付金额')" />
            </div>
          </div>
          <div>
            <div class="text-xs font-bold text-slate-400">收款地址</div>
            <div class="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-semibold text-slate-800">
              {{ active.pay_address || '等待网关返回地址' }}
            </div>
            <Button
              v-if="active.pay_address"
              class="mt-3"
              label="复制地址"
              icon="pi pi-copy"
              size="small"
              severity="secondary"
              outlined
              @click="copyText(active.pay_address || '', '已复制收款地址')"
            />
          </div>
          <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>剩余支付时间</span>
            <span class="font-mono text-base font-bold text-slate-800">{{ countdown }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button label="我已支付" icon="pi pi-refresh" :loading="submitting" @click="refreshActive" />
            <Button label="取消订单" severity="secondary" text :loading="cancelling" @click="cancelOrder" />
          </div>
        </div>
      </div>

      <div v-else class="mt-6 rounded-2xl bg-slate-50 px-5 py-6">
        <p class="font-semibold text-slate-800">
          {{ active.status === 1 ? `已到账 ${active.points} 积分` : statusOf(active.status).label }}
        </p>
        <p v-if="active.tx_id" class="mt-2 break-all font-mono text-xs text-slate-400">交易哈希 {{ active.tx_id }}</p>
        <Button class="mt-4" label="继续充值" @click="active = null" />
      </div>
    </section>

    <section v-else class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-1 text-sm font-bold text-slate-900">充值数量</div>
      <p class="mb-4 text-sm text-slate-500">{{ rateText || '请选择已开放的充值渠道' }}</p>
      <div v-if="selected && selected.status === 1" class="flex flex-wrap gap-2">
        <button
          v-for="preset in selected.presets"
          :key="preset"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-semibold transition"
          :class="points === preset ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-200'"
          @click="choosePreset(preset)"
        >
          {{ preset }} 积分<span v-if="yuanLabel(preset)" class="ml-1 text-xs font-medium opacity-70">{{ yuanLabel(preset) }}</span>
        </button>
      </div>
      <div class="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div class="w-full sm:max-w-xs">
          <label class="mb-2 block text-xs font-bold text-slate-500">自定义积分</label>
          <InputNumber
            v-model="points"
            class="w-full"
            :min="selected?.min_points ?? 100"
            :max="selected?.max_points ?? 1000000"
            :use-grouping="false"
            input-class="w-full"
            :disabled="!enabledChannels.length"
          />
        </div>
        <Button
          label="创建 USDT 订单"
          icon="pi pi-wallet"
          :loading="submitting"
          :disabled="!selected || selected.status !== 1"
          @click="createOrder"
        />
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="mb-4 text-sm font-bold text-slate-900">充值记录</div>
      <div v-if="loading" class="py-10 text-center text-sm text-slate-400">加载中…</div>
      <div v-else-if="!orders.length" class="py-12 text-center">
        <i class="pi pi-wallet text-4xl text-slate-300" />
        <p class="mt-3 font-semibold text-slate-700">还没有充值记录</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-left text-sm">
          <thead class="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">时间</th>
              <th class="px-4 py-3">订单号</th>
              <th class="px-4 py-3">渠道</th>
              <th class="px-4 py-3">积分</th>
              <th class="px-4 py-3">应付</th>
              <th class="px-4 py-3">状态</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="order in orders" :key="order.order_no" class="hover:bg-slate-50">
              <td class="whitespace-nowrap px-4 py-4 text-slate-500">{{ fmtDate(order.created_at) }}</td>
              <td class="px-4 py-4 font-mono text-xs text-slate-500">{{ order.order_no }}</td>
              <td class="px-4 py-4 font-semibold text-slate-800">{{ order.channel_name || order.channel_code }}</td>
              <td class="px-4 py-4 font-semibold">{{ order.points }}</td>
              <td class="px-4 py-4 text-slate-600">
                <span v-if="order.actual_amount != null">{{ formatUsdt(order.actual_amount) }} USDT</span>
                <span v-else>{{ formatAmount(order) }}</span>
              </td>
              <td class="px-4 py-4">
                <button v-if="order.status === 0" type="button" class="text-left" @click="openOrder(order)">
                  <Tag :value="statusOf(order.status).label" :severity="statusOf(order.status).severity" class="cursor-pointer" />
                </button>
                <Tag v-else :value="statusOf(order.status).label" :severity="statusOf(order.status).severity" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
