import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import Wujie from 'wujie-vue3'//引入对应的框架
// import Wujie from 'wujie-vue3-test'//引入封装的框架
import {a,b} from 'common'//引入公共模块

//预加载
const {preloadApp} = Wujie



const app = createApp(App)

app.use(router).use(Wujie)//注册对应的框架

app.mount('#app')

preloadApp({name:'react',url:'http://127.0.0.1:5174/',exec:true})//预加载react框架，exec为true表示加载完成后立即执行
preloadApp({name:'vue3',url:'http://127.0.0.1:5175/',exec:true})//预加载vue框架
