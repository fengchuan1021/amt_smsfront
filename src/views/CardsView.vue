<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { fmtDate, formatYuan, pointsToYuan, yuanToPoints } from '@/lib/format';
import type { Card as PhoneCard, CardGroup, Paged, Project } from '@/types';

const ISP_OPTIONS = [
  { label: '未设置', value: 0 },
  { label: '中国移动', value: 1 },
  { label: '中国联通', value: 2 },
  { label: '中国电信', value: 3 },
  { label: '中国广电', value: 4 },
  { label: '虚拟卡', value: 5 },
];
const AREA_OPTIONS = [
  '未设置', '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东',
  '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
].map((label, value) => ({ label, value }));

const toast = useToast();
const cards = ref<PhoneCard[]>([]);
const groups = ref<CardGroup[]>([]);
const projects = ref<Project[]>([]);
const search = ref('');
const groupFilter = ref<number | string>('all');
const bulkGroup = ref<number | string | null>(null);
const selected = ref<number[]>([]);
const loading = ref(true);
const dialogVisible = ref(false);
const groupDialogVisible = ref(false);
const moveDialogVisible = ref(false);
const priceDialogVisible = ref(false);
const priceForm = ref<Record<number, number | null>>({});
const priceTargetIds = ref<number[]>([]);
const submitting = ref(false);
const groupName = ref('');
const editingId = ref<number | null>(null);
const moveCard = ref<PhoneCard | null>(null);
const moveGroup = ref<number | string>('none');
const form = ref({ phone: '', device_id: '', remark: '', group_id: null as number | null, card_isp: 0, card_area: 0, status: 1 as 0 | 1 });

const filteredCards = computed(() => {
  const q = search.value.trim().toLowerCase();
  const filter = groupFilter.value;
  return cards.value.filter((item) => {
    const matchesText = !q || `${item.phone} ${item.device_id || ''} ${item.remark || ''}`.toLowerCase().includes(q);
    const matchesGroup = filter === 'all' || (filter === 'none' ? item.group_id === null : item.group_id === Number(filter));
    return matchesText && matchesGroup;
  });
});
const allVisibleSelected = computed(() => filteredCards.value.length > 0 && filteredCards.value.every((item) => selected.value.includes(item.id)));
const projectNameMap = computed(() => new Map(projects.value.map((project) => [project.id, project.name])));

function projectsPriceOf(item: PhoneCard): Map<number, number> {
  const map = new Map<number, number>();
  for (const part of (item.projects_price || '').split(',')) {
    const [idStr, priceStr] = part.split(':');
    const id = Number(idStr);
    const price = Number(priceStr);
    if (Number.isInteger(id) && id > 0 && Number.isInteger(price) && price >= 0) {
      map.set(id, price);
    }
  }
  return map;
}

function customPriceLabel(item: PhoneCard): string {
  const count = projectsPriceOf(item).size;
  return count ? `自定义 ${count} 项` : '无自定义';
}

function customPriceTitle(item: PhoneCard): string {
  const map = projectsPriceOf(item);
  if (!map.size) return '未设置项目自定义价格';
  return [...map.entries()]
    .map(([id, price]) => `${projectNameMap.value.get(id) ?? `项目 ${id}`}: ${formatYuan(price)} 元`)
    .join('、');
}

function openPriceFor(ids: number[]): void {
  if (!ids.length) return;
  priceTargetIds.value = [...ids];
  const maps = ids.map((id) => {
    const card = cards.value.find((item) => item.id === id);
    return card ? projectsPriceOf(card) : new Map<number, number>();
  });
  for (const project of projects.value) {
    const values = new Set(maps.map((map) => map.get(project.id)));
    const raw = values.size === 1 ? values.values().next().value : undefined;
    priceForm.value[project.id] = raw == null ? null : pointsToYuan(raw);
  }
  priceDialogVisible.value = true;
}

async function savePrices(): Promise<void> {
  if (!priceTargetIds.value.length) return;
  const prices = projects.value
    .filter((project) => priceForm.value[project.id] != null)
    .map((project) => ({ project_id: project.id, price: yuanToPoints(priceForm.value[project.id] as number) }));
  submitting.value = true;
  try {
    await request('/cards/bulk/prices', { method: 'POST', body: { ids: priceTargetIds.value, prices } });
    priceDialogVisible.value = false;
    priceForm.value = {};
    toast.add({ severity: 'success', summary: '项目价格已保存', detail: `已更新 ${priceTargetIds.value.length} 张手机卡，自定义价格优先于项目默认价格`, life: 3000 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '保存价格失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally { submitting.value = false; }
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [data, groupData, projectData] = await Promise.all([
      request<Paged<PhoneCard>>('/cards?page_size=100'),
      request<{ items: CardGroup[] }>('/cards/groups'),
      request<Paged<Project>>('/projects?page_size=100'),
    ]);
    cards.value = data.items;
    groups.value = groupData.items;
    projects.value = projectData.items;
    selected.value = selected.value.filter((id) => cards.value.some((item) => item.id === id));
  } catch (error) {
    toast.add({ severity: 'error', summary: '加载失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally {
    loading.value = false;
  }
}

function toggleVisibleSelection(): void {
  const ids = filteredCards.value.map((item) => item.id);
  selected.value = allVisibleSelected.value ? selected.value.filter((id) => !ids.includes(id)) : [...new Set([...selected.value, ...ids])];
}

function optionLabel(options: { label: string; value: number }[], value: number | null | undefined): string {
  return options.find((option) => option.value === value)?.label ?? '未设置';
}

function emptyForm() {
  return { phone: '', device_id: '', remark: '', group_id: null as number | null, card_isp: 0, card_area: 0, status: 1 as 0 | 1 };
}

function openCreate(): void {
  editingId.value = null;
  form.value = emptyForm();
  dialogVisible.value = true;
}

function openEdit(item: PhoneCard): void {
  editingId.value = item.id;
  form.value = {
    phone: item.phone,
    device_id: item.device_id || '',
    remark: item.remark || '',
    group_id: item.group_id,
    card_isp: item.card_isp ?? 0,
    card_area: item.card_area ?? 0,
    status: item.status === 0 ? 0 : 1,
  };
  dialogVisible.value = true;
}

function openMove(item: PhoneCard): void {
  moveCard.value = item;
  moveGroup.value = item.group_id ?? 'none';
  moveDialogVisible.value = true;
}

async function saveCard(): Promise<void> {
  submitting.value = true;
  const payload = {
    phone: form.value.phone.trim(),
    device_id: form.value.device_id.trim() || null,
    remark: form.value.remark.trim() || null,
    group_id: form.value.group_id,
    card_isp: form.value.card_isp,
    card_area: form.value.card_area,
  };
  try {
    if (editingId.value) {
      await request(`/cards/${editingId.value}`, { method: 'PATCH', body: { ...payload, status: form.value.status } });
      toast.add({ severity: 'success', summary: '已保存', detail: '手机卡信息已更新', life: 2200 });
    } else {
      await request('/cards', { method: 'POST', body: { ...payload, device_id: payload.device_id || undefined, remark: payload.remark || undefined, group_id: payload.group_id || undefined } });
      toast.add({ severity: 'success', summary: '添加成功', detail: '手机卡已添加', life: 2200 });
    }
    dialogVisible.value = false;
    editingId.value = null;
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: editingId.value ? '保存失败' : '添加失败', detail: error instanceof Error ? error.message : '请检查输入', life: 3000 });
  } finally { submitting.value = false; }
}

async function confirmMove(): Promise<void> {
  if (!moveCard.value) return;
  const groupId = moveGroup.value === 'none' ? null : Number(moveGroup.value);
  submitting.value = true;
  try {
    await request('/cards/bulk/group', { method: 'POST', body: { ids: [moveCard.value.id], group_id: groupId } });
    moveDialogVisible.value = false;
    toast.add({ severity: 'success', summary: '分组已更新', detail: moveCard.value.phone, life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '移动分组失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally { submitting.value = false; }
}

async function removeOne(item: PhoneCard): Promise<void> {
  if (!window.confirm(`确定删除手机号 ${item.phone}？`)) return;
  try {
    await request(`/cards/${item.id}`, { method: 'DELETE' });
    toast.add({ severity: 'success', summary: '已删除', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '删除失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function removeSelected(): Promise<void> {
  if (!selected.value.length || !window.confirm(`确定删除选中的 ${selected.value.length} 张手机卡？此操作不可撤销。`)) return;
  try {
    const result = await request<{ deleted: number }>('/cards/bulk', { method: 'DELETE', body: { ids: selected.value } });
    selected.value = [];
    toast.add({ severity: 'success', summary: '批量删除完成', detail: `已删除 ${result.deleted} 张手机卡`, life: 2500 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '删除失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function assignGroup(): Promise<void> {
  if (!selected.value.length || bulkGroup.value === null || bulkGroup.value === '') {
    toast.add({ severity: 'warn', summary: '请选择要移动到的分组', life: 1800 });
    return;
  }
  const groupId = bulkGroup.value === 'none' ? null : Number(bulkGroup.value);
  try {
    await request('/cards/bulk/group', { method: 'POST', body: { ids: selected.value, group_id: groupId } });
    selected.value = [];
    bulkGroup.value = null;
    toast.add({ severity: 'success', summary: '分组已更新', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '分组操作失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function createGroup(): Promise<void> {
  const name = groupName.value.trim();
  if (!name) return;
  submitting.value = true;
  try {
    await request('/cards/groups', { method: 'POST', body: { name } });
    groupName.value = '';
    groupDialogVisible.value = false;
    toast.add({ severity: 'success', summary: '分组已创建', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '创建分组失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  } finally { submitting.value = false; }
}

async function deleteGroup(group: CardGroup): Promise<void> {
  if (!window.confirm(`确定删除分组「${group.name}」？组内手机卡会保留并移至未分组。`)) return;
  try {
    await request(`/cards/groups/${group.id}`, { method: 'DELETE' });
    if (groupFilter.value === group.id) groupFilter.value = 'all';
    await load();
    toast.add({ severity: 'success', summary: '分组已删除', detail: '手机卡已保留在未分组中', life: 2200 });
  } catch (error) {
    toast.add({ severity: 'error', summary: '删除分组失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

onMounted(load);
</script>

<template>
  <Card>
    <template #content>
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex flex-1 flex-col gap-2 sm:flex-row">
          <InputText v-model="search" class="w-full sm:max-w-sm" placeholder="搜索手机号、设备标识或备注" />
          <Select v-model="groupFilter" class="w-full sm:max-w-48" :options="[{ label: '全部分组', value: 'all' }, { label: '未分组', value: 'none' }, ...groups.map((group) => ({ label: group.name, value: group.id }))]" option-label="label" option-value="value" placeholder="筛选分组" />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button label="管理分组" icon="pi pi-folder-plus" severity="secondary" outlined @click="groupDialogVisible = true" />
          <Button label="添加手机卡" icon="pi pi-plus" @click="openCreate" />
        </div>
      </div>
      <div v-if="groups.length" class="mt-3 flex flex-wrap gap-2">
        <span v-for="group in groups" :key="group.id" class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {{ group.name }} <span class="text-indigo-400">{{ group.card_count ?? 0 }}</span>
          <button class="ml-1 text-indigo-400 hover:text-red-600" :aria-label="`删除分组${group.name}`" @click="deleteGroup(group)">×</button>
        </span>
      </div>
    </template>
  </Card>

  <Card class="mt-5">
    <template #content>
      <div v-if="selected.length" class="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 p-3">
        <span class="mr-2 text-sm font-semibold text-indigo-800">已选择 {{ selected.length }} 张</span>
        <!-- <Button label="设置价格" icon="pi pi-tag" severity="secondary" size="small" @click="openPriceFor(selected)" /> -->
        <Select v-model="bulkGroup" class="w-44" :options="[{ label: '移至未分组', value: 'none' }, ...groups.map((group) => ({ label: `移至 ${group.name}`, value: group.id }))]" option-label="label" option-value="value" placeholder="批量移动到分组" @update:model-value="assignGroup" />
        <Button label="批量删除" icon="pi pi-trash" severity="danger" size="small" @click="removeSelected" />
        <Button label="取消选择" severity="secondary" text size="small" @click="selected = []" />
      </div>
      <div v-if="loading" class="space-y-3 py-6 text-center text-sm text-slate-400">加载中…</div>
      <div v-else-if="filteredCards.length === 0" class="py-14 text-center">
        <i class="pi pi-mobile text-4xl text-slate-300" />
        <p class="mt-3 font-semibold text-slate-700">还没有手机卡</p>
        <p class="mt-1 text-sm text-slate-400">点击「添加手机卡」录入你的第一张卡</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[1680px] text-left text-sm">
          <thead class="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
            <tr><th class="w-12 px-4 py-3"><input type="checkbox" :checked="allVisibleSelected" aria-label="选择当前列表全部手机卡" @change="toggleVisibleSelection" /></th><th class="px-4 py-3">手机号</th><th class="px-4 py-3">运营商</th><th class="px-4 py-3">地区</th><th class="px-4 py-3">设备标识</th><th class="px-4 py-3">分组</th><th class="px-4 py-3">备注</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">最后上报</th><th class="px-4 py-3">已用项目</th><th class="min-w-[280px] px-4 py-3">操作</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in filteredCards" :key="item.id" class="transition hover:bg-slate-50">
              <td class="px-4 py-4"><input v-model="selected" type="checkbox" :value="item.id" :aria-label="`选择手机号${item.phone}`" /></td>
              <td class="px-4 py-4 font-mono font-semibold text-slate-800">{{ item.phone }}</td>
              <td class="px-4 py-4 text-slate-600">{{ optionLabel(ISP_OPTIONS, item.card_isp) }}</td>
              <td class="px-4 py-4 text-slate-600">{{ optionLabel(AREA_OPTIONS, item.card_area) }}</td>
              <td class="px-4 py-4 font-mono text-xs text-slate-500">{{ item.device_id || '-' }}</td>
              <td class="px-4 py-4"><Tag :value="item.group_name || '未分组'" :severity="item.group_name ? 'info' : 'secondary'" /></td>
              <!-- <td class="px-4 py-4"><Tag :value="customPriceLabel(item)" :severity="projectsPriceOf(item).size ? 'info' : 'secondary'" :title="customPriceTitle(item)" /></td> -->
              <td class="px-4 py-4 text-slate-500">{{ item.remark || '-' }}</td>
              <td class="px-4 py-4"><Tag :value="item.status === 1 ? '启用' : '停用'" :severity="item.status === 1 ? 'success' : 'secondary'" /></td>
              <td class="whitespace-nowrap px-4 py-4 text-slate-500">{{ fmtDate(item.last_seen_at) }}</td>
              <td class="px-4 py-4">
                <span v-if="!item.used_projects" class="text-slate-400">-</span>
                <span v-else class="inline-flex flex-wrap gap-1">
                  <Tag v-for="name in item.used_projects.split('、')" :key="name" :value="name" severity="info" />
                </span>
              </td>
              <td class="min-w-[280px] whitespace-nowrap px-4 py-4">
                <Button label="编辑" text size="small" @click="openEdit(item)" />
                <Button label="移动分组" text size="small" @click="openMove(item)" />
                <Button label="删除" severity="danger" text size="small" @click="removeOne(item)" />
                <!-- <Button label="设置价格" text size="small" @click="openPriceFor([item.id])" /> -->
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!loading && filteredCards.length" class="mt-4 text-xs text-slate-400">共 {{ filteredCards.length }} 张卡</div>
    </template>
  </Card>

  <Dialog v-model:visible="dialogVisible" modal :header="editingId ? '编辑手机卡' : '添加手机卡'" :style="{ width: 'min(92vw, 480px)' }">
    <form class="space-y-4" @submit.prevent="saveCard">
      <div><label class="mb-2 block text-xs font-bold text-slate-500">手机号</label><InputText v-model="form.phone" class="w-full" required placeholder="例如 13800000000" /></div>
      <div><label class="mb-2 block text-xs font-bold text-slate-500">设备标识</label><InputText v-model="form.device_id" class="w-full" placeholder="手机唯一标识（可选）" /></div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="mb-2 block text-xs font-bold text-slate-500">运营商</label><Select v-model="form.card_isp" class="w-full" :options="ISP_OPTIONS" option-label="label" option-value="value" placeholder="未设置" /></div>
        <div><label class="mb-2 block text-xs font-bold text-slate-500">所属地区</label><Select v-model="form.card_area" class="w-full" :options="AREA_OPTIONS" option-label="label" option-value="value" placeholder="未设置" filter /></div>
      </div>
      <div><label class="mb-2 block text-xs font-bold text-slate-500">所属分组</label><Select v-model="form.group_id" class="w-full" :options="groups.map((group) => ({ label: group.name, value: group.id }))" option-label="label" option-value="value" placeholder="暂不分组" show-clear /></div>
      <div v-if="editingId"><label class="mb-2 block text-xs font-bold text-slate-500">状态</label><Select v-model="form.status" class="w-full" :options="[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]" option-label="label" option-value="value" /></div>
      <div><label class="mb-2 block text-xs font-bold text-slate-500">备注</label><Textarea v-model="form.remark" class="w-full" rows="3" placeholder="可选" /></div>
      <div class="flex justify-end gap-2 pt-2"><Button label="取消" severity="secondary" text type="button" @click="dialogVisible = false" /><Button :label="editingId ? '保存' : '添加'" type="submit" :loading="submitting" /></div>
    </form>
  </Dialog>
  <Dialog v-model:visible="moveDialogVisible" modal header="移动到分组" :style="{ width: 'min(92vw, 400px)' }">
    <div class="space-y-4">
      <p class="text-sm text-slate-600">将 <span class="font-mono font-semibold text-slate-800">{{ moveCard?.phone }}</span> 移动到所选分组。</p>
      <Select v-model="moveGroup" class="w-full" :options="[{ label: '未分组', value: 'none' }, ...groups.map((group) => ({ label: group.name, value: group.id }))]" option-label="label" option-value="value" placeholder="选择分组" />
      <div class="flex justify-end gap-2"><Button label="取消" severity="secondary" text type="button" @click="moveDialogVisible = false" /><Button label="确定" type="button" :loading="submitting" @click="confirmMove" /></div>
    </div>
  </Dialog>
  <!-- <Dialog v-model:visible="priceDialogVisible" modal header="设置项目价格" :style="{ width: 'min(92vw, 560px)' }">
    <div class="space-y-4">
      <p class="text-xs leading-5 text-slate-400">将应用到 {{ priceTargetIds.length }} 张手机卡。空白表示使用项目默认价格，确认后会覆盖这些手机卡原有的项目价格设置。</p>
      <div class="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        <div v-for="project in projects" :key="project.id" class="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-2 last:border-0">
          <span class="text-slate-700">{{ project.name }}</span>
          <div class="w-40">
            <InputNumber v-model="priceForm[project.id]" :min="0" :max="10000" :min-fraction-digits="2" :max-fraction-digits="2" :step="0.01" :use-grouping="false" :placeholder="`默认 ${formatYuan(project.price)} 元`" class="w-full" :aria-label="`${project.name} 自定义价格`" />
          </div>
          <span class="text-xs text-slate-400">{{ formatYuan(project.price) }} 元</span>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button label="取消" severity="secondary" text type="button" @click="priceDialogVisible = false" />
        <Button label="确定" type="button" :loading="submitting" @click="savePrices" />
      </div>
    </div>
  </Dialog> -->
  <Dialog v-model:visible="groupDialogVisible" modal header="新建手机卡分组" :style="{ width: 'min(92vw, 400px)' }">
    <form class="space-y-4" @submit.prevent="createGroup">
      <div><label class="mb-2 block text-xs font-bold text-slate-500">分组名称</label><InputText v-model="groupName" class="w-full" maxlength="64" required placeholder="例如：移动卡 / 测试号码" /></div>
      <p class="text-xs text-slate-400">分组仅用于整理当前卡商名下的手机卡。删除分组不会删除其中的手机卡。</p>
      <div class="flex justify-end gap-2"><Button label="取消" severity="secondary" text type="button" @click="groupDialogVisible = false" /><Button label="创建分组" type="submit" :loading="submitting" /></div>
    </form>
  </Dialog>
</template>
