<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import { useToast } from 'primevue/usetoast';
import StatCard from '@/components/StatCard.vue';
import { request } from '@/lib/api';
import { fmtDate, formatYuan } from '@/lib/format';
import { auth, role, setBalance } from '@/stores/auth';
import type { Stats } from '@/types';

interface StatItem {
  label: string;
  value: number | string;
  icon: string;
  accent?: boolean;
}

const router = useRouter();
const toast = useToast();
const stats = ref<Stats | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const data = await request<Stats>('/stats');
    stats.value = data;
    setBalance(data.balance);
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
});

const roleLabel = computed(() => ({ admin: '管理员', dealer: '卡商', consumer: '消费者' })[role.value]);

const cards = computed<StatItem[]>(() => {
  const s = stats.value;
  if (!s) return [];
  if (role.value === 'admin') {
    return [
      { label: '用户总数', value: s.users ?? 0, icon: 'pi pi-users', accent: true },
      { label: '卡商数量', value: s.dealers ?? 0, icon: 'pi pi-shop' },
      { label: '手机卡', value: s.cards ?? 0, icon: 'pi pi-mobile' },
      { label: '项目数', value: s.projects ?? 0, icon: 'pi pi-folder' },
      { label: '短信总数', value: s.sms ?? 0, icon: 'pi pi-comments' },
    ];
  }
  if (role.value === 'dealer') {
    return [
      { label: '账户余额', value: `${formatYuan(s.balance)} 元`, icon: 'pi pi-wallet', accent: true },
      { label: '手机卡', value: s.cards ?? 0, icon: 'pi pi-mobile' },
      { label: '已上报短信', value: s.sms ?? 0, icon: 'pi pi-comments' },
      { label: '累计收入', value: `${formatYuan(s.income ?? 0)} 元`, icon: 'pi pi-chart-line' },
    ];
  }
  return [
    { label: '账户余额', value: `${formatYuan(s.balance)} 元`, icon: 'pi pi-wallet', accent: true },
    { label: '已读短信', value: s.reads ?? 0, icon: 'pi pi-envelope' },
    { label: '累计消耗', value: `${formatYuan(s.spent ?? 0)} 元`, icon: 'pi pi-chart-line' },
  ];
});

const quickLinks = computed(() => {
  const links: Array<{ label: string; to: string; icon: string }> = [
    { label: '充值', to: '/recharge', icon: 'pi pi-wallet' },
  ];
  if (role.value === 'dealer' || role.value === 'admin') {
    links.push({ label: '管理手机卡', to: '/cards', icon: 'pi pi-mobile' });

  }
  links.push({ label: '读取短信', to: '/read', icon: 'pi pi-search' });
  if (role.value === 'admin') links.push({ label: '用户管理', to: '/users', icon: 'pi pi-users' });
  return links;
});

async function copyInvite(): Promise<void> {
  if (!auth.user?.invite_code) return;
  try {
    await navigator.clipboard.writeText(auth.user.invite_code);
    toast.add({ severity: 'success', summary: '已复制', detail: '邀请码已复制到剪贴板', life: 1800 });
  } catch {
    toast.add({ severity: 'error', summary: '复制失败', detail: '当前环境不支持剪贴板', life: 2200 });
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <template v-if="loading">
        <div v-for="n in 4" :key="n" class="rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton width="40%" height="0.8rem" />
          <Skeleton width="55%" height="2rem" class="mt-3" />
        </div>
      </template>
      <StatCard v-for="item in cards" v-else :key="item.label" v-bind="item" />
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-5 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">账户信息</h2>
          <Tag :value="roleLabel" severity="info" />
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div class="text-xs font-semibold text-slate-400">用户名</div>
            <div class="mt-1 font-semibold text-slate-800">{{ auth.user?.username }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-400">注册时间</div>
            <div class="mt-1 font-semibold text-slate-800">{{ fmtDate(auth.user?.created_at) }}</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-400">账户余额</div>
            <div class="mt-1 font-semibold text-slate-800">{{ formatYuan(auth.user?.balance) }} 元</div>
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-400">状态</div>
            <div class="mt-1">
              <Tag :value="auth.user?.status === 1 ? '正常' : '禁用'" :severity="auth.user?.status === 1 ? 'success' : 'danger'" />
            </div>
          </div>
        </div>
        <div class="my-5 h-px bg-slate-100" />
        <div class="text-xs font-bold uppercase tracking-wider text-slate-400">我的邀请码</div>
        <div class="mt-2 flex items-center gap-2">
          <div class="flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 font-mono font-bold tracking-[0.2em] text-indigo-600">
            {{ auth.user?.invite_code || '-' }}
          </div>
          <Button icon="pi pi-copy" label="复制" severity="secondary" outlined size="small" @click="copyInvite" />
        </div>
        <p class="mt-2 text-xs text-slate-400">好友注册时填写你的邀请码，即可成为你的下级。</p>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="mb-5 text-base font-bold text-slate-900">快捷操作</h2>
        <div class="space-y-2.5">
          <button
            v-for="link in quickLinks"
            :key="link.to"
            class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-700"
            @click="router.push(link.to)"
          >
            <i :class="link.icon" class="text-indigo-500" />
            <span>{{ link.label }}</span>
            <i class="pi pi-arrow-right ml-auto text-xs text-slate-300" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
