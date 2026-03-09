<template>
  <div class="home">
    <h1>Home Page</h1>
    <UsedButton @click="handleButtonClick">
      Click Me
    </UsedButton>
    <ReactUsed onClick={handleReactClick}>
      React Component
    </ReactUsed>
  </div>
</template>

<script>
import UsedButton from '../components/UsedButton.vue';
import ReactUsed from '../components/ReactUsed.jsx';
import { formatDate, formatCurrency } from '../utils/helpers.js';

export default {
  name: 'Home',
  components: {
    UsedButton,
    ReactUsed,
  },
  data() {
    return {
      date: new Date(),
      amount: 100,
    };
  },
  methods: {
    handleButtonClick() {
      console.log('Button clicked');
      console.log(formatDate(this.date));
    },
    handleReactClick() {
      console.log('React clicked');
      console.log(formatCurrency(this.amount));
    },
  },
};
</script>

<style scoped>
.home {
  padding: 20px;
}
</style>
