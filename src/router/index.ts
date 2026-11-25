import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import { auth, clearSession, refreshMe } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true, title: '登录' },
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '概览', subtitle: '账户与数据一览' },
        },
        {
          path: 'recharge',
          name: 'recharge',
          component: () => import('@/views/RechargeView.vue'),
          meta: { title: '充值积分', subtitle: '使用 USDT 等方式为账户充值积分' },
        },
        {
          path: 'cards',
          name: 'cards',
          component: () => import('@/views/CardsView.vue'),
          meta: { title: '手机卡', subtitle: '管理你名下的手机卡与设备绑定', roles: ['dealer', 'admin'] },
        },
        {
          path: 'projects',
          name: 'projects',
          component: () => import('@/views/admin/ProjectsView.vue'),
          meta: { title: '项目管理', subtitle: '创建并管理短信项目与计费单价', roles: ['admin'] },
        },
        {
          path: 'dealer/projects',
          name: 'dealer-projects',
          component: () => import('@/views/card_dealer/CardDealerProjectsView.vue'),
          meta: { title: '项目', subtitle: '查看管理员创建的短信项目', roles: ['dealer'] },
        },
        {
          path: 'sms',
          name: 'sms',
          component: () => import('@/views/SmsView.vue'),
          meta: { title: '短信记录', subtitle: '查看上报与消费的短信记录' },
        },
        {
          path: 'read',
          name: 'read',
          component: () => import('@/views/ReadSmsView.vue'),
          meta: { title: ' ', subtitle: '' },
        },
        {
          path: 'reads',
          name: 'reads',
          component: () => import('@/views/ReadsView.vue'),
          meta: { title: '我的消费', subtitle: '查看你读取短信的积分消耗', roles: ['consumer'] },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { title: '用户管理', subtitle: '管理用户、充值与角色权限', roles: ['admin'] },
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !auth.token) return { name: 'login' };
  if (to.meta.guest && auth.token) return { name: 'dashboard' };

  if (to.meta.requiresAuth && auth.token && !auth.user) {
    try {
      await refreshMe();
    } catch {
      clearSession();
      return { name: 'login' };
    }
  }

  const roles = to.meta.roles as string[] | undefined;
  if (roles && auth.user) {
    const currentRole = auth.user.is_admin ? 'admin' : auth.user.is_card_dealer ? 'dealer' : 'consumer';
    if (!roles.includes(currentRole)) return { name: 'dashboard' };
  }

  document.title = to.meta.title ? `AntSMS · ${to.meta.title}` : 'AntSMS';
  return true;
});

export default router;
