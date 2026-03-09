<template>
  <div class="the-header">
    <slot></slot>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>
