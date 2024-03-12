import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')


declare global {
    interface Window {
      $wujie: {
        props:  Record<string, any>
        bus: {
          $emit: any
        }
      }
    }
  }
  