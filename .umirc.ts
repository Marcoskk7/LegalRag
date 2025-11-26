import { defineConfig } from '@umijs/max';

const repoName = 'LegalRag';
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  base: isProd ? `/${repoName}/` : '/',
  publicPath: isProd ? `/${repoName}/` : '/',
  history: {
    type: 'hash',
  },
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
