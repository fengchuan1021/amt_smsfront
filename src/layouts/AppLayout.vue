<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import { auth, logout, role } from '@/stores/auth';
import { initials } from '@/lib/format';
import { request } from '@/lib/api';
import type { Paged, Project } from '@/types';

interface NavItem {
  label: string;
  icon: string;
  to: string;
  roles?: string[];
}

const route = useRoute();
const router = useRouter();
const userMenu = ref();
const mobileMenuOpen = ref(false);

const navItems: NavItem[] = [
  { label: '概览', icon: 'pi pi-home', to: '/dashboard' },
  { label: '充值积分', icon: 'pi pi-wallet', to: '/recharge' },
  { label: '手机卡', icon: 'pi pi-mobile', to: '/cards', roles: ['dealer', 'admin'] },
  { label: '项目管理', icon: 'pi pi-folder', to: '/projects', roles: ['admin'] },
  { label: '项目', icon: 'pi pi-folder', to: '/dealer/projects', roles: ['dealer'] },
  { label: '信息接收', icon: 'pi pi-search', to: '/read' },
  { label: '短信记录', icon: 'pi pi-comments', to: '/sms' },

  { label: '我的消费', icon: 'pi pi-receipt', to: '/reads', roles: ['consumer'] },
  { label: '用户管理', icon: 'pi pi-users', to: '/users', roles: ['admin'] },
];

const visibleNavItems = computed(() => navItems.filter((item) => !item.roles || item.roles.includes(role.value)));
const pageTitle = computed(() => String(route.meta.title || '概览'));
const pageSubtitle = computed(() => String(route.meta.subtitle || ''));
const roleLabel = computed(() => ({ admin: '管理员', dealer: '卡商', consumer: '消费者' })[role.value]);
const menuModel = [{ label: '退出登录', icon: 'pi pi-sign-out', command: () => handleLogout() }];

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(`${to}/`);
}

function handleLogout(): void {
  logout();
  router.replace({ name: 'login' });
}

function navigate(to: string): void {
  mobileMenuOpen.value = false;
  router.push(to);
}

const apps = ref<Project[]>([]);
const iconFailed = reactive<Record<number, boolean>>({});

const selectedAppId = computed(() => {
  if (route.name !== 'read') return null;
  const raw = route.query.project_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
});

function iconSrc(app: Project): string {
  if (iconFailed[app.id]) return '/default-app.svg';
  return `/${encodeURIComponent(app.name)}.png`;
}

function onIconError(id: number): void {
  if (iconFailed[id]) return;
  iconFailed[id] = true;
}

function openApp(app: Project): void {
  router.push({ name: 'read', query: { project_id: String(app.id) } });
}

onMounted(async () => {
  try {
    const data = await request<Paged<Project>>('/projects?page_size=30');
    apps.value = data.items;
  } catch {
    apps.value = [];
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div class="flex h-[72px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <Button
            icon="pi pi-bars"
            severity="secondary"
            text
            rounded
            class="lg:!hidden"
            aria-label="打开菜单"
            @click="mobileMenuOpen = !mobileMenuOpen"
          />
          <div class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#FFF6D8]">
            <img src="/yazi.png" alt="鸭子接码" class="h-9 w-9 object-contain" />
          </div>
          <div class="hidden sm:block">
            <div class="text-lg font-extrabold tracking-tight text-slate-900">鸭子接码</div>
          
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            class="hidden items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-100 sm:flex"
            @click="navigate('/recharge')"
          >
            <i class="pi pi-wallet text-xs" />
            <span>{{ auth.user?.balance ?? 0 }} 积分</span>
          </button>
          <div class="hidden text-right sm:block">
            <div class="text-sm font-semibold text-slate-800">{{ auth.user?.username }}</div>
            <div class="text-xs text-slate-400">{{ roleLabel }}</div>
          </div>
          <Avatar
            :label="initials(auth.user?.username)"
            shape="circle"
            class="brand-gradient !text-sm !font-bold !text-white"
          />
          <Button
            icon="pi pi-ellipsis-v"
            severity="secondary"
            text
            rounded
            aria-label="用户菜单"
            @click="userMenu.toggle($event)"
          />
          <Menu ref="userMenu" :model="menuModel" :popup="true" />
        </div>
      </div>
    </header>

    <div class="flex min-h-[calc(100vh-72px)]">
      <aside
        class="fixed inset-y-[72px] left-0 z-30 w-64 border-r border-slate-200 bg-white px-4 py-6 transition-transform lg:static lg:translate-x-0"
        :class="mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
      >
        <div class="mb-5 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"></div>
        <nav class="space-y-1">
          <button
            v-for="item in visibleNavItems"
            :key="item.to"
            class="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all"
            :class="isActive(item.to) ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
            @click="navigate(item.to)"
          >
            <i :class="[item.icon, isActive(item.to) ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600']" class="text-[17px]" />
            <span>{{ item.label }}</span>
            <i v-if="isActive(item.to)" class="pi pi-angle-right ml-auto text-xs" />
          </button>
        </nav>

    
      </aside>

      <button
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-20 bg-slate-900/20 lg:hidden"
        aria-label="关闭菜单"
        @click="mobileMenuOpen = false"
      />

      <main class="min-w-0 flex-1">
        <div v-if="apps.length" class="px-4 pt-6 sm:px-6 lg:px-8">
          <div class="mx-auto max-w-[1440px]">
            <div class="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              <button
                v-for="app in apps"
                :key="app.id"
                type="button"
                class="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition hover:bg-white"
                :class="selectedAppId === app.id ? 'bg-white ring-2 ring-indigo-200' : ''"
                :aria-label="app.name"
                @click="openApp(app)"
              >
                <img
                  :src="iconSrc(app)"
                  :alt="app.name"
                  class="h-12 w-12 rounded-2xl object-cover"
                  @error="onIconError(app.id)"
                />
                <span class="line-clamp-2 w-full text-xs font-medium leading-4 text-slate-700">{{ app.name }}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" />
            </Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>
