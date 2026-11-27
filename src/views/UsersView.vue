<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { fmtDate, formatYuan, yuanToPoints } from '@/lib/format';
import type { AdminUser, Paged } from '@/types';

const toast = useToast();
const users = ref<AdminUser[]>([]);
const search = ref('');
const loading = ref(true);
const dialogVisible = ref(false);
const submitting = ref(false);
const currentUser = ref<AdminUser | null>(null);
const rechargeForm = ref({ yuan: 1, remark: '' });

const filteredUsers = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter((item) => item.username.toLowerCase().includes(q));
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    const data = await request<Paged<AdminUser>>('/admin/users?page_size=100');
    users.value = data.items;
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
}

function openRecharge(user: AdminUser): void {
  currentUser.value = user;
  rechargeForm.value = { yuan: 1, remark: '' };
  dialogVisible.value = true;
}

async function recharge(): Promise<void> {
  if (!currentUser.value) return;
  submitting.value = true;
  try {
    await request(`/admin/users/${currentUser.value.id}/recharge`, {
      method: 'POST',
      body: { points: yuanToPoints(rechargeForm.value.yuan), remark: rechargeForm.value.remark.trim() || undefined },
    });
    dialogVisible.value = false;
    toast.add({ severity: 'success', summary: '充值成功', life: 2000 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '充值失败', detail: error instanceof Error ? error.message : '请检查输入', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

async function toggleDealer(user: AdminUser): Promise<void> {
  try {
    await request(`/admin/users/${user.id}`, { method: 'PATCH', body: { is_card_dealer: user.is_card_dealer ? 0 : 1 } });
    toast.add({ severity: 'success', summary: user.is_card_dealer ? '已取消卡商' : '已设为卡商', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '操作失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function toggleStatus(user: AdminUser): Promise<void> {
  const next = user.status === 1 ? 0 : 1;
  if (next === 0 && !window.confirm(`确定禁用用户 ${user.username}？`)) return;
  try {
    await request(`/admin/users/${user.id}`, { method: 'PATCH', body: { status: next } });
    toast.add({ severity: 'success', summary: next === 1 ? '已启用' : '已禁用', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '操作失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

onMounted(load);
</script>

<template>
  <Card>
    <template #content>
      <InputText v-model="search" class="w-full sm:max-w-sm" placeholder="搜索用户名" />
    </template>
  </Card>

  <Card class="mt-5">
    <template #content>
      <div v-if="loading" class="py-12 text-center text-sm text-slate-400">加载中…</div>
      <div v-else-if="!filteredUsers.length" class="py-14 text-center"><i class="pi pi-users text-4xl text-slate-300" /><p class="mt-3 font-semibold text-slate-700">没有用户</p><p class="mt-1 text-sm text-slate-400">没有匹配的用户</p></div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left text-sm">
          <thead class="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400"><tr><th class="px-4 py-3">用户名</th><th class="px-4 py-3">角色</th><th class="px-4 py-3">余额（元）</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">邀请码</th><th class="px-4 py-3">注册时间</th><th class="px-4 py-3">操作</th></tr></thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="user in filteredUsers" :key="user.id" class="hover:bg-slate-50">
              <td class="px-4 py-4 font-semibold text-slate-800">{{ user.username }}</td>
              <td class="px-4 py-4"><Tag v-if="user.is_admin" value="管理员" severity="warn" /><Tag v-else-if="user.is_card_dealer" value="卡商" severity="info" /><Tag v-else value="消费者" severity="secondary" /></td>
              <td class="px-4 py-4 font-semibold text-slate-800">{{ formatYuan(user.balance) }}</td>
              <td class="px-4 py-4"><Tag :value="user.status === 1 ? '正常' : '禁用'" :severity="user.status === 1 ? 'success' : 'danger'" /></td>
              <td class="px-4 py-4 font-mono text-xs text-slate-500">{{ user.invite_code }}</td>
              <td class="whitespace-nowrap px-4 py-4 text-slate-500">{{ fmtDate(user.created_at) }}</td>
              <td class="px-4 py-4"><div class="flex flex-wrap gap-1"><Button label="充值" size="small" severity="secondary" text @click="openRecharge(user)" /><Button :label="user.is_card_dealer ? '取消卡商' : '设为卡商'" size="small" severity="secondary" text @click="toggleDealer(user)" /><Button :label="user.status === 1 ? '禁用' : '启用'" size="small" :severity="user.status === 1 ? 'danger' : 'success'" text @click="toggleStatus(user)" /></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Card>

  <Dialog v-model:visible="dialogVisible" modal :header="`为 ${currentUser?.username ?? ''} 充值`" :style="{ width: 'min(92vw, 420px)' }">
    <form class="space-y-4" @submit.prevent="recharge">
      <div><label class="mb-2 block text-xs font-bold text-slate-500">充值金额（元）</label><InputNumber v-model="rechargeForm.yuan" class="w-full" :min="0.01" :max="1000000" :min-fraction-digits="2" :max-fraction-digits="2" :step="0.01" :use-grouping="false" input-class="w-full" /></div>
      <div><label class="mb-2 block text-xs font-bold text-slate-500">备注</label><InputText v-model="rechargeForm.remark" class="w-full" placeholder="可选" /></div>
      <div class="flex justify-end gap-2 pt-2"><Button label="取消" severity="secondary" text type="button" @click="dialogVisible = false" /><Button label="确认充值" type="submit" :loading="submitting" /></div>
    </form>
  </Dialog>
</template>
