<template>
  <button class="used-button" @click="handleClick">
    <slot />
  </button>
</template>

<script>
export default {
  name: 'UsedButton',
  methods: {
    handleClick() {
      this.$emit('click');
    },
  },
};
</script>

<style scoped>
.used-button {
  padding: 8px 16px;
}
</style>
