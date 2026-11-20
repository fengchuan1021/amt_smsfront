<script setup lang="ts">
import Toast from 'primevue/toast';
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { clearSession, refreshMe } from '@/stores/auth';

const router = useRouter();

function handleExpired(): void {
  clearSession();
  router.replace({ name: 'login' });
}

onMounted(() => {
  window.addEventListener('auth:expired', handleExpired);
  if (localStorage.getItem('ant_sms_token')) {
    refreshMe().catch(() => handleExpired());
  }
});

onUnmounted(() => window.removeEventListener('auth:expired', handleExpired));
</script>

<template>
  <Toast position="top-right" />
  <RouterView />
</template>
