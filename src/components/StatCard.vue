<script setup lang="ts">
defineProps<{
  label: string;
  value: number | string;
  icon: string;
  accent?: boolean;
}>();
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md"
    :class="accent ? 'brand-gradient border-transparent text-white' : 'border-slate-200 bg-white'"
  >
    <div class="text-xs font-semibold" :class="accent ? 'text-white/80' : 'text-slate-500'">{{ label }}</div>
    <div class="mt-2 text-3xl font-extrabold tracking-tight" :class="accent ? 'text-white' : 'text-slate-900'">{{ value }}</div>
    <div
      class="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl"
      :class="accent ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'"
    >
      <i :class="icon" class="text-lg" />
    </div>
  </div>
</template>
