<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Divider from 'primevue/divider';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import RadioButton from 'primevue/radiobutton';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { ApiError } from '@/lib/api';
import { login, register } from '@/stores/auth';

const router = useRouter();
const toast = useToast();
const activeTab = ref<'login' | 'register'>('login');
const loading = ref(false);
const loginForm = ref({ username: '', password: '' });
const registerForm = ref({ username: '', password: '', invite_code: '', is_card_dealer: false });
const errorMessage = ref('');

const title = computed(() => (activeTab.value === 'login' ? '欢迎回来' : '创建账号'));
const subtitle = computed(() =>
  activeTab.value === 'login' ? '登录后即可管理手机卡、项目与短信。' : '选择身份后即可开始使用。',
);

const usernameModel = computed({
  get: () => (activeTab.value === 'login' ? loginForm.value.username : registerForm.value.username),
  set: (value: string) => {
    if (activeTab.value === 'login') loginForm.value.username = value;
    else registerForm.value.username = value;
  },
});

const passwordModel = computed({
  get: () => (activeTab.value === 'login' ? loginForm.value.password : registerForm.value.password),
  set: (value: string) => {
    if (activeTab.value === 'login') loginForm.value.password = value;
    else registerForm.value.password = value;
  },
});

function switchTab(tab: 'login' | 'register'): void {
  activeTab.value = tab;
  errorMessage.value = '';
}

function showError(error: unknown): void {
  errorMessage.value = error instanceof ApiError ? error.message : '操作失败，请稍后重试';
}

async function submit(): Promise<void> {
  errorMessage.value = '';
  loading.value = true;
  try {
    if (activeTab.value === 'login') {
      await login(loginForm.value.username.trim(), loginForm.value.password);
    } else {
      await register({
        username: registerForm.value.username.trim(),
        password: registerForm.value.password,
        is_card_dealer: registerForm.value.is_card_dealer,
        invite_code: registerForm.value.invite_code.trim() || undefined,
      });
    }
    toast.add({ severity: 'success', summary: '登录成功', detail: '欢迎使用 AntSMS', life: 1800 });
    await router.replace({ name: 'dashboard' });
  } catch (error) {
    showError(error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-slate-50">
    <div class="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-violet-200/40 blur-3xl" />
    <div class="absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full bg-indigo-200/40 blur-3xl" />
    <div class="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section class="brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div class="absolute -right-36 -top-36 h-[520px] w-[520px] rounded-full bg-white/10 blur-2xl" />
        <div class="flex items-center gap-3 text-xl font-extrabold">
          <!-- <div class="grid h-10 w-10 place-items-center rounded-xl border border-white/30 bg-white/15 text-lg backdrop-blur"></div> -->
          鸭子接码
        </div>
        <div class="relative max-w-lg">
          <h1 class="text-5xl font-extrabold leading-tight tracking-tight">短信管理，<br />一个平台全部搞定</h1>
          <p class="mt-6 text-base leading-7 text-white/75">面向卡商与消费者的短信聚合平台。手机端一键上报，按项目与号码实时读取最新短信，积分自动结算。</p>
          <div class="mt-9 space-y-4 text-sm text-white/90">
            <div class="flex items-center gap-3"><span class="grid h-8 w-8 place-items-center rounded-lg bg-white/15">✦</span>手机端上报短信，设备与号码双重校验</div>
            <div class="flex items-center gap-3"><span class="grid h-8 w-8 place-items-center rounded-lg bg-white/15">◈</span>按手机号 + 项目读取最新一条，秒级响应</div>
            <div class="flex items-center gap-3"><span class="grid h-8 w-8 place-items-center rounded-lg bg-white/15">✧</span>积分计费，重复读取自动去重不重复扣费</div>
          </div>
        </div>
        <div class="text-sm text-white/55">Powered by Cloudflare Workers · D1</div>
      </section>

      <section class="flex items-center justify-center p-5 sm:p-10">
        <Card class="w-full max-w-[430px] !rounded-3xl !border-slate-200/80 !shadow-2xl !shadow-slate-200/70">
          <template #content>
            <div class="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition" :class="activeTab === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'" @click="switchTab('login')">登录</button>
              <button class="flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition" :class="activeTab === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'" @click="switchTab('register')">注册</button>
            </div>

            <div class="mt-7">
              <h2 class="text-2xl font-extrabold tracking-tight text-slate-900">{{ title }}</h2>
              <p class="mt-1 text-sm text-slate-500">{{ subtitle }}</p>
            </div>

            <Message v-if="errorMessage" severity="error" :closable="false" class="mt-5">{{ errorMessage }}</Message>

            <form class="mt-6 space-y-4" @submit.prevent="submit">
              <div v-if="activeTab === 'register'">
                <label class="mb-2 block text-xs font-bold text-slate-500">身份</label>
                <div class="grid grid-cols-2 gap-3">
                  <label class="cursor-pointer rounded-xl border p-3 transition" :class="!registerForm.is_card_dealer ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-200'">
                    <RadioButton v-model="registerForm.is_card_dealer" :value="false" input-id="consumer" />
                    <span class="ml-2 text-sm font-semibold text-slate-700">消费者</span>
                    <span class="mt-1 block pl-7 text-[11px] text-slate-400">读取短信、消耗积分</span>
                  </label>
                  <label class="cursor-pointer rounded-xl border p-3 transition" :class="registerForm.is_card_dealer ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-200'">
                    <RadioButton v-model="registerForm.is_card_dealer" :value="true" input-id="dealer" />
                    <span class="ml-2 text-sm font-semibold text-slate-700">卡商</span>
                    <span class="mt-1 block pl-7 text-[11px] text-slate-400">上报短信、赚取积分</span>
                  </label>
                </div>
              </div>
              <div>
                <label for="username" class="mb-2 block text-xs font-bold text-slate-500">用户名</label>
                <InputText id="username" v-model="usernameModel" class="w-full" placeholder="字母、数字或下划线" required />
              </div>
              <div>
                <label for="password" class="mb-2 block text-xs font-bold text-slate-500">密码</label>
                <Password id="password" v-model="passwordModel" class="w-full" input-class="w-full" :feedback="false" toggle-mask placeholder="至少 6 位" required />
              </div>
              <div v-if="activeTab === 'register'">
                <label for="invite" class="mb-2 block text-xs font-bold text-slate-500">邀请码 <span class="font-normal text-slate-400">（选填）</span></label>
                <InputText id="invite" v-model="registerForm.invite_code" class="w-full" placeholder="填写邀请人的邀请码" />
              </div>
              <Button :label="activeTab === 'login' ? '登录' : '注册并登录'" type="submit" class="w-full !rounded-xl" :loading="loading" />
            </form>
            <Divider />
            <p class="text-center text-xs text-slate-400">安全可靠的短信管理基础设施</p>
          </template>
        </Card>
      </section>
    </div>
  </main>
</template>
