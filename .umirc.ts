import { defineConfig } from '@umijs/max';

export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
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
  ],
  npmClient: 'pnpm',
});
