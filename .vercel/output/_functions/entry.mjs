import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_DAELXGHr.mjs';
import { manifest } from './manifest_D_b6ZruE.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/404.astro.mjs');
const _page2 = () => import('./pages/admin/statistika.astro.mjs');
const _page3 = () => import('./pages/api/keystatic/_---params_.astro.mjs');
const _page4 = () => import('./pages/hozir.astro.mjs');
const _page5 = () => import('./pages/keystatic/_---params_.astro.mjs');
const _page6 = () => import('./pages/koz-sogligi.astro.mjs');
const _page7 = () => import('./pages/maxfiylik.astro.mjs');
const _page8 = () => import('./pages/men-haqimda.astro.mjs');
const _page9 = () => import('./pages/qaydlar/_slug_.astro.mjs');
const _page10 = () => import('./pages/qaydlar.astro.mjs');
const _page11 = () => import('./pages/rss.xml.astro.mjs');
const _page12 = () => import('./pages/yozuvlar/mavzu/_pillar_.astro.mjs');
const _page13 = () => import('./pages/yozuvlar/_slug_.astro.mjs');
const _page14 = () => import('./pages/yozuvlar.astro.mjs');
const _page15 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/.pnpm/astro@5.18.2_@types+node@24.13.3_@vercel+functions@2.2.13_idb-keyval@6.3.0_rollup@4.62.3_typescript@5.9.3_yaml@2.9.0/node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/404.astro", _page1],
    ["src/pages/admin/statistika.astro", _page2],
    ["node_modules/.pnpm/@keystatic+astro@5.2.0_@keystatic+core@0.6.4_@keystar+ui@0.9.1_react-aria@3.50.0_react-_7423b314fae8f2aec29714b7b88acb5e/node_modules/@keystatic/astro/internal/keystatic-api.js", _page3],
    ["src/pages/hozir.astro", _page4],
    ["node_modules/.pnpm/@keystatic+astro@5.2.0_@keystatic+core@0.6.4_@keystar+ui@0.9.1_react-aria@3.50.0_react-_7423b314fae8f2aec29714b7b88acb5e/node_modules/@keystatic/astro/internal/keystatic-astro-page.astro", _page5],
    ["src/pages/koz-sogligi.astro", _page6],
    ["src/pages/maxfiylik.astro", _page7],
    ["src/pages/men-haqimda.astro", _page8],
    ["src/pages/qaydlar/[slug].astro", _page9],
    ["src/pages/qaydlar/index.astro", _page10],
    ["src/pages/rss.xml.ts", _page11],
    ["src/pages/yozuvlar/mavzu/[pillar].astro", _page12],
    ["src/pages/yozuvlar/[slug].astro", _page13],
    ["src/pages/yozuvlar/index.astro", _page14],
    ["src/pages/index.astro", _page15]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "da08a9f6-1c56-4cf1-b653-85623ae30768",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) ;

export { __astrojsSsrVirtualEntry as default, pageMap };
