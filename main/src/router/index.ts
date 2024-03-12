import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/Home.vue') // 你的首页组件
    },
    {
      path: '/vue3',
      component: ()=> import('@/components/vue3.vue')
    },
    {
      path: '/react',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('@/components/react.vue')
    }
  ]
})

export default router
