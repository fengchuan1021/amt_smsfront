<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
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
  return `/appicons/${encodeURIComponent(app.name)}.png`;
}

function onIconError(id: number): void {
  if (iconFailed[id]) return;
  iconFailed[id] = true;
}

const ROWS_PER_PAGE = 3;
const COLUMN_BREAKPOINTS = [
  { min: 1024, cols: 10 },
  { min: 768, cols: 8 },
  { min: 640, cols: 6 },
  { min: 0, cols: 4 },
] as const;
const DOT_WINDOW = 9;

const columns = ref(4);
const pageIndex = ref(0);
const viewportEl = ref<HTMLElement | null>(null);
const slideWidth = ref(0);
const dragX = ref(0);
const dragging = ref(false);

let pointerId = -1;
let originX = 0;
let originY = 0;
let lockAxis: 'x' | 'y' | null = null;
let suppressClick = false;
let resizeObserver: ResizeObserver | null = null;

const pageSize = computed(() => columns.value * ROWS_PER_PAGE);

const pages = computed(() => {
  const size = pageSize.value;
  const chunks: Project[][] = [];
  for (let i = 0; i < apps.value.length; i += size) chunks.push(apps.value.slice(i, i + size));
  return chunks;
});

const dotIndexes = computed(() => {
  const total = pages.value.length;
  if (total <= DOT_WINDOW) return Array.from({ length: total }, (_, index) => index);
  const half = Math.floor(DOT_WINDOW / 2);
  let start = pageIndex.value - half;
  if (start < 0) start = 0;
  if (start > total - DOT_WINDOW) start = total - DOT_WINDOW;
  return Array.from({ length: DOT_WINDOW }, (_, index) => start + index);
});

const trackStyle = computed(() => ({
  transform: `translate3d(${-pageIndex.value * slideWidth.value + dragX.value}px, 0, 0)`,
  transition: dragging.value ? 'none' : 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
}));

function updateColumns(): void {
  const width = window.innerWidth;
  const match = COLUMN_BREAKPOINTS.find((item) => width >= item.min);
  columns.value = match?.cols ?? 4;
}

function measureSlide(): void {
  slideWidth.value = viewportEl.value?.clientWidth ?? 0;
}

function revealSelected(): void {
  const id = selectedAppId.value;
  if (id == null || !apps.value.length) return;
  const index = apps.value.findIndex((app) => app.id === id);
  if (index < 0) return;
  pageIndex.value = Math.floor(index / pageSize.value);
}

function goTo(index: number): void {
  const max = pages.value.length - 1;
  if (max < 0) return;
  pageIndex.value = Math.min(max, Math.max(0, index));
}

function nextPage(): void {
  goTo(pageIndex.value + 1);
}

function prevPage(): void {
  goTo(pageIndex.value - 1);
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || pages.value.length <= 1) return;
  dragging.value = true;
  pointerId = event.pointerId;
  originX = event.clientX;
  originY = event.clientY;
  lockAxis = null;
  dragX.value = 0;
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || event.pointerId !== pointerId) return;
  const dx = event.clientX - originX;
  const dy = event.clientY - originY;
  if (!lockAxis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    lockAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (lockAxis === 'y') {
      dragging.value = false;
      dragX.value = 0;
      return;
    }
    try {
      viewportEl.value?.setPointerCapture(event.pointerId);
    } catch {
      /* 合成事件或指针已释放时忽略捕获失败 */
    }
  }
  const atStart = pageIndex.value === 0 && dx > 0;
  const atEnd = pageIndex.value === pages.value.length - 1 && dx < 0;
  dragX.value = atStart || atEnd ? dx * 0.28 : dx;
}

function finishDrag(event: PointerEvent): void {
  if (pointerId !== -1 && event.pointerId !== pointerId) return;
  const dx = dragX.value;
  const moved = lockAxis === 'x' && Math.abs(dx) > 48;
  dragging.value = false;
  dragX.value = 0;
  pointerId = -1;
  lockAxis = null;
  if (!moved) return;
  suppressClick = true;
  window.setTimeout(() => {
    suppressClick = false;
  }, 0);
  if (dx < 0) nextPage();
  else prevPage();
}

function openApp(app: Project): void {
  if (suppressClick) return;
  router.push({ name: 'read', query: { project_id: String(app.id) } });
}

watch(pageSize, (size, prev) => {
  if (!prev) return;
  const first = pageIndex.value * prev;
  const max = Math.max(0, Math.ceil(apps.value.length / size) - 1);
  pageIndex.value = Math.min(max, Math.floor(first / size));
});

watch(selectedAppId, () => {
  revealSelected();
});

watch(viewportEl, (el) => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (!el) return;
  measureSlide();
  resizeObserver = new ResizeObserver(() => measureSlide());
  resizeObserver.observe(el);
});

onMounted(async () => {
  updateColumns();
  window.addEventListener('resize', updateColumns);
  try {
    const data = await request<Paged<Project>>('/projects?page_size=150');
    apps.value = data.items;
    revealSelected();
  } catch {
    apps.value = [];
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns);
  resizeObserver?.disconnect();
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
          <div class="mx-auto max-w-[1440px]" role="region" aria-roledescription="carousel" aria-label="应用">
            <div
              ref="viewportEl"
              class="overflow-hidden"
              :class="dragging ? 'cursor-grabbing select-none' : pages.length > 1 ? 'cursor-grab' : ''"
              style="touch-action: pan-y"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="finishDrag"
              @pointercancel="finishDrag"
            >
              <div class="flex" :style="trackStyle">
                <div
                  v-for="(page, index) in pages"
                  :key="page[0]?.id ?? index"
                  class="shrink-0"
                  :style="{ width: slideWidth ? `${slideWidth}px` : '100%' }"
                >
                  <div class="grid gap-x-2 gap-y-4 p-1" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
                    <button
                      v-for="app in page"
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
                        draggable="false"
                        class="h-12 w-12 rounded-2xl object-cover"
                        @error="onIconError(app.id)"
                      />
                      <span class="line-clamp-2 w-full text-xs font-medium leading-4 text-slate-700">{{ app.name }}</span>
                    </button>
                    <div
                      v-for="slot in pageSize - page.length"
                      :key="`pad-${index}-${slot}`"
                      class="flex flex-col items-center gap-1.5 px-1 py-2"
                      aria-hidden="true"
                    >
                      <div class="h-12 w-12" />
                      <span class="h-8 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="pages.length > 1" class="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                class="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-indigo-600 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                :disabled="pageIndex === 0"
                aria-label="上一页"
                @click="prevPage"
              >
                <i class="pi pi-chevron-left text-xs" />
              </button>
              <div class="flex items-center gap-1.5">
                <button
                  v-for="dot in dotIndexes"
                  :key="dot"
                  type="button"
                  class="h-1.5 rounded-full transition-all"
                  :class="dot === pageIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'"
                  :aria-label="`第 ${dot + 1} 页`"
                  :aria-current="dot === pageIndex ? 'true' : undefined"
                  @click="goTo(dot)"
                />
              </div>
              <span v-if="pages.length > DOT_WINDOW" class="text-[11px] tabular-nums text-slate-400">
                {{ pageIndex + 1 }}/{{ pages.length }}
              </span>
              <button
                type="button"
                class="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-white hover:text-indigo-600 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                :disabled="pageIndex === pages.length - 1"
                aria-label="下一页"
                @click="nextPage"
              >
                <i class="pi pi-chevron-right text-xs" />
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
