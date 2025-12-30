import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  proxy: {
    // 开发环境：让前端通过同源 /api 访问本地后端，避免浏览器 CORS 问题
    '/api': {
      // 对齐本地后端 runserver.py 默认端口（你日志里是 0.0.0.0:8080）
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
  layout: {
    title: '@umijs/max',
  },
  routes: [
    {
      path: '/',
      redirect: '/portal',
    },
    {
      name: 'Portal',
      path: '/portal',
      component: './Portal',
    },
    {
      name: '上传',
      path: '/upload',
      component: './Upload',
    },
    {
      name: '分析',
      path: '/contract-analysis',
      component: './ContractAnalysis',
    },
    {
      name: '历史记录',
      path: '/history',
      component: './History',
    },
  ],
  npmClient: 'pnpm',
  mfsu: false,
});
