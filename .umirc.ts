import { defineConfig } from '@umijs/max';

export default defineConfig({
  // GitHub Pages 部署配置
  base: '/LegalRag/',
  publicPath: '/LegalRag/',
  history: { type: 'hash' },
  exportStatic: {},
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
      redirect: '/home',
    },
    {
      name: '首页',
      path: '/home',
      component: './Home',
    },
    {
      name: '权限演示',
      path: '/access',
      component: './Access',
    },
    {
      name: ' CRUD 示例',
      path: '/table',
      component: './Table',
    },
    {
      name: '上传',
      path: '/upload',
      component: './Upload',
    },
    {
      name: 'Portal',
      path: '/portal',
      component: './Portal',
      layout: false,
    },
    {
      name:'分析',
      path: '/contract-analysis',
      component: './ContractAnalysis',
    }
  ],
  npmClient: 'pnpm',
});
