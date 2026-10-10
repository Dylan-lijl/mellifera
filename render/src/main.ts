import App from './App.vue'
import "normalize.css"
import {router} from './router'
import {createPinia} from 'pinia'
import {init} from "./initialization";

const pinia = createPinia()
const app = createApp(App)
    .use(pinia)
    .use(router);
app.mount('#app')
await init()


