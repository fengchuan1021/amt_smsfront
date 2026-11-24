import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import 'primeicons/primeicons.css';
import './style.css';
import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: 'none',
      cssLayer: false,
    },
  },
  license:"eyJpZCI6IjljMjhhMmNlLWQ3YWUtNGVjMC1iOTdlLWE4YzlmNzljYWE1YyIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3OTU1MjExMTQsImV4cCI6MTgyNzA1NzExNH0.S7iQq5ksvZmdzqxHFLQoBVCyH7zy-O-fdEi8ozqGBysibe6CeKUoVRqi8GeLrA_feGjBYgpCpRAV8shDtQwmCQ"
});
app.use(ToastService);
app.directive('tooltip', Tooltip);
app.mount('#app');
