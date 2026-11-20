<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Avatar from 'primevue/avatar';
import Menu from 'primevue/menu';
import { auth, logout, role } from '@/stores/auth';
import { initials } from '@/lib/format';

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
  { label: '手机卡', icon: 'pi pi-mobile', to: '/cards', roles: ['dealer', 'admin'] },
  { label: '项目管理', icon: 'pi pi-folder', to: '/projects', roles: ['admin'] },
  { label: '项目', icon: 'pi pi-folder', to: '/dealer/projects', roles: ['dealer'] },
  { label: '短信记录', icon: 'pi pi-comments', to: '/sms' },
  { label: '读取短信', icon: 'pi pi-search', to: '/read' },
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
          <div class="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white shadow-lg shadow-indigo-200">
            A
          </div>
          <div class="hidden sm:block">
            <div class="text-lg font-extrabold tracking-tight text-slate-900">AntSMS</div>
            <div class="text-xs text-slate-400">短信管理平台</div>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-4">
          <div class="hidden items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 sm:flex">
            <i class="pi pi-wallet text-xs" />
            <span>{{ auth.user?.balance ?? 0 }} 积分</span>
          </div>
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
        <div class="mb-5 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">工作台</div>
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

        <div class="mt-8 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
          <div class="mb-2 flex items-center gap-2 text-indigo-700">
            <i class="pi pi-info-circle" />
            <span class="text-xs font-bold">使用提示</span>
          </div>
          <p class="text-xs leading-5 text-indigo-600/70">手机端上报短信后，可在「读取短信」中按号码和项目查询最新消息。</p>
        </div>
      </aside>

      <button
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-20 bg-slate-900/20 lg:hidden"
        aria-label="关闭菜单"
        @click="mobileMenuOpen = false"
      />

      <main class="min-w-0 flex-1">
        <div class="border-b border-slate-200/70 bg-white/50 px-4 py-6 sm:px-6 lg:px-8">
          <div class="mx-auto max-w-[1440px]">
            <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">{{ pageTitle }}</h1>
            <p class="mt-1 text-sm text-slate-500">{{ pageSubtitle }}</p>
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
