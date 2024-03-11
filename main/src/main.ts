import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import Wujie from 'wujie-vue3'//引入对应的框架

import {a,b} from 'common'




const app = createApp(App)

app.use(router).use(Wujie)//注册对应的框架

app.mount('#app')
