<template>
  <div class="test-vue-component">
    <h1>{{ title }}</h1>
    <button @click="handleClick">Click me</button>
  </div>
</template>

<script>
export default {
  name: 'TestVueComponent',
  props: {
    title: {
      type: String,
      default: 'Test Component'
    }
  },
  methods: {
    handleClick() {
      this.$emit('click');
    }
  }
}
</script>

<style scoped>
.test-vue-component {
  padding: 20px;
}
</style>
