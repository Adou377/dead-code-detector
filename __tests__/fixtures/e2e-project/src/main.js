import { createApp } from 'vue';
import App from './App.vue';
import Home from './views/Home.vue';

const app = createApp(App);
app.component('Home', Home);
app.mount('#app');
