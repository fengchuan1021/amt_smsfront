<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { request } from '@/lib/api';
import { role } from '@/stores/auth';
import type { Paged, Project } from '@/types';

const toast = useToast();
const projects = ref<Project[]>([]);
const search = ref('');
const loading = ref(true);
const dialogVisible = ref(false);
const submitting = ref(false);
const editingId = ref<number | null>(null);
const form = ref({ name: '', description: '', price: null as number | null, keyword: '' });

const canCreate = computed(() => role.value === 'admin');
const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return projects.value;
  return projects.value.filter((item) => `${item.name} ${item.description || ''} ${item.keyword || ''}`.toLowerCase().includes(q));
});

function canManage(): boolean {
  return role.value === 'admin';
}

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

function openCreate(): void {
  editingId.value = null;
  form.value = { name: '', description: '', price: null, keyword: '' };
  dialogVisible.value = true;
}

function openEdit(item: Project): void {
  editingId.value = item.id;
  form.value = { name: item.name, description: item.description || '', price: item.price, keyword: item.keyword || '' };
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  submitting.value = true;
  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    price: form.value.price ?? 0,
    keyword: form.value.keyword.trim(),
  };
  try {
    if (editingId.value) {
      await request(`/projects/${editingId.value}`, { method: 'PATCH', body: payload });
      toast.add({ severity: 'success', summary: '已更新', detail: '项目已更新', life: 2000 });
    } else {
      await request('/projects', { method: 'POST', body: payload });
      toast.add({ severity: 'success', summary: '创建成功', detail: '项目已创建', life: 2000 });
    }
    dialogVisible.value = false;
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '保存失败', detail: error instanceof Error ? error.message : '请检查输入', life: 3000 });
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(item: Project): Promise<void> {
  try {
    await request(`/projects/${item.id}`, { method: 'PATCH', body: { status: item.status === 1 ? 0 : 1 } });
    toast.add({ severity: 'success', summary: item.status === 1 ? '已停用' : '已启用', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '操作失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

async function remove(item: Project): Promise<void> {
  if (!window.confirm(`确定删除项目「${item.name}」？`)) return;
  try {
    await request(`/projects/${item.id}`, { method: 'DELETE' });
    toast.add({ severity: 'success', summary: '已删除', life: 1800 });
    await load();
  } catch (error) {
    toast.add({ severity: 'error', summary: '删除失败', detail: error instanceof Error ? error.message : '请稍后重试', life: 3000 });
  }
}

onMounted(load);
</script>

<template>
  <Card>
    <template #content>
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <InputText v-model="search" class="w-full sm:max-w-sm" placeholder="搜索项目名称或说明" />
        <Button v-if="canCreate" label="新建项目" icon="pi pi-plus" @click="openCreate" />
      </div>
    </template>
  </Card>

  <div v-if="loading" class="mt-5 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">加载中…</div>
  <div v-else-if="filteredProjects.length === 0" class="mt-5 rounded-2xl border border-slate-200 bg-white py-16 text-center">
    <i class="pi pi-folder-open text-4xl text-slate-300" />
    <p class="mt-3 font-semibold text-slate-700">暂无项目</p>
    <p class="mt-1 text-sm text-slate-400">还没有任何项目，先创建一个吧</p>
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
      <div class="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
        <div class="text-sm font-extrabold text-indigo-600">{{ item.price }} <span class="text-xs font-semibold text-slate-400">积分/次</span></div>
        <div class="truncate text-xs text-slate-400">关键词 {{ item.keyword || '未设置' }}</div>
      </div>
      <div v-if="canManage()" class="flex flex-wrap gap-2">
        <Button label="编辑" severity="secondary" outlined size="small" @click="openEdit(item)" />
        <Button :label="item.status === 1 ? '停用' : '启用'" severity="secondary" text size="small" @click="toggleStatus(item)" />
        <Button label="删除" severity="danger" text size="small" @click="remove(item)" />
      </div>
    </article>
  </div>

  <Dialog v-model:visible="dialogVisible" modal :header="editingId ? '编辑项目' : '新建项目'" :style="{ width: 'min(92vw, 460px)' }">
    <form class="space-y-4" @submit.prevent="save">
      <div><label class="mb-2 block text-xs font-bold text-slate-500">项目名称</label><InputText v-model="form.name" class="w-full" required placeholder="例如 验证码项目" /></div>
      <div><label class="mb-2 block text-xs font-bold text-slate-500">项目说明</label><Textarea v-model="form.description" class="w-full" rows="3" placeholder="可选" /></div>
      <div>
        <label class="mb-2 block text-xs font-bold text-slate-500">关键词</label>
        <InputText v-model="form.keyword" class="w-full" maxlength="128" placeholder="可选" />
        <p class="mt-1 text-xs text-slate-400">短信内容包含该关键词时匹配到本项目，留空则不参与匹配</p>
      </div>
      <div>
        <label class="mb-2 block text-xs font-bold text-slate-500">单次读取积分</label>
        <InputNumber v-model="form.price" class="w-full" :min="0" :max="1000000" :use-grouping="false" input-class="w-full" placeholder="100积分等于1元"/>
        <p class="mt-1 text-xs text-slate-400">消费者每次读取新短信时扣除的积分</p>
      </div>
      <div class="flex justify-end gap-2 pt-2"><Button label="取消" severity="secondary" text type="button" @click="dialogVisible = false" /><Button :label="editingId ? '保存' : '创建'" type="submit" :loading="submitting" /></div>
    </form>
  </Dialog>
</template>
