// @ts-check
//打包后会将结果输出到对应的包下的dist目录，
// 常见的格式vue.global.js
// vue.esm-bundler.js（不会打包此模块的依赖模块，给webpack等构建工具使用）
// vue.esm-browser.js (会将依赖打包到模块中，可在浏览器中直接使用)

// Using esbuild for faster dev builds.
// We are still using Rollup for production builds because it generates
// smaller files and provides better tree-shaking.

import esbuild from 'esbuild'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import minimist from 'minimist'
// 使用了node中的包，如何去解析这个包 TODO:
import { polyfillNode } from 'esbuild-plugin-polyfill-node'
// $ node example/parse.js -x 3 -y 4 -n5 -abc --beep=boop foo bar baz
// {
// 	_: ['foo', 'bar', 'baz'],
// 	x: 3,
// 	y: 4,
// 	n: 5,
// 	a: true,
// 	b: true,
// 	c: true,
// 	beep: 'boop'
// }
const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const args = minimist(process.argv.slice(2))
const targets = args._.length ? args._ : ['vue']
console.log('targets', targets)
// global:会在window上挂载一个属性 window.vue
const format = args.f || 'global'
const prod = args.p || false
// 打包的vue包里面有很多依赖，是否要将这些依赖打包的一个包中
// 内联所有依赖
const inlineDeps = args.i || args.inline
// resolve output
const outputFormat = format.startsWith('global')
  ? 'iife'
  : format === 'cjs'
    ? 'cjs'
    : 'esm'

const postfix = format.endsWith('-runtime')
  ? `runtime.${format.replace(/-runtime$/, '')}`
  : format

for (const target of targets) {
  const pkg = require(`../packages/${target}/package.json`)
  const outfile = resolve(
    __dirname,
    `../packages/${target}/dist/${
      target === 'vue-compat' ? `vue` : target
    }.${postfix}.${prod ? `prod.` : ``}js`,
  )
  const relativeOutfile = relative(process.cwd(), outfile)

  // resolve externals
  // TODO this logic is largely duplicated from rollup.config.js
  /** @type {string[]} */
  let external = []
  if (!inlineDeps) {
    // cjs & esm-bundler: external all deps
    // node scripts/dev.js reactivity -f esm-bundler 打包的是reactivity模块
    if (format === 'cjs' || format.includes('esm-bundler')) {
      // 如果不是把依赖打包在一起，需要配置external，排除掉依赖的模块
      external = [
        ...external,
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        // TODO:
        // for @vue/compiler-sfc / server-renderer
        'path',
        'url',
        'stream',
      ]
    }

    if (target === 'compiler-sfc') {
      const consolidatePkgPath = require.resolve(
        '@vue/consolidate/package.json',
        {
          paths: [resolve(__dirname, `../packages/${target}/`)],
        },
      )
      const consolidateDeps = Object.keys(
        require(consolidatePkgPath).devDependencies,
      )
      external = [
        ...external,
        ...consolidateDeps,
        'fs',
        'vm',
        'crypto',
        'react-dom/server',
        'teacup/lib/express',
        'arc-templates/dist/es5',
        'then-pug',
        'then-jade',
      ]
    }
  }
  /** @type {Array<import('esbuild').Plugin>} */
  const plugins = [
    {
      name: 'log-rebuild',
      setup(build) {
        build.onEnd(() => {
          console.log(`built: ${relativeOutfile}`)
        })
      },
    },
  ]

  if (format !== 'cjs' && pkg.buildOptions?.enableNonBrowserBranches) {
    plugins.push(polyfillNode())
  }

  esbuild
    .context({
      entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
      outfile,
      // 默认将所有的包打包到一起
      bundle: true,
      // 排除掉不需要打包的模块
      external,
      sourcemap: true,
      format: outputFormat,
      globalName: pkg.buildOptions?.name,
      platform: format === 'cjs' ? 'node' : 'browser',
      plugins,
      define: {
        __COMMIT__: `"dev"`,
        __VERSION__: `"${pkg.version}"`,
        __DEV__: prod ? `false` : `true`,
        __TEST__: `false`,
        __BROWSER__: String(
          format !== 'cjs' && !pkg.buildOptions?.enableNonBrowserBranches,
        ),
        __GLOBAL__: String(format === 'global'),
        __ESM_BUNDLER__: String(format.includes('esm-bundler')),
        __ESM_BROWSER__: String(format.includes('esm-browser')),
        __CJS__: String(format === 'cjs'),
        __SSR__: String(format === 'cjs' || format.includes('esm-bundler')),
        __COMPAT__: String(target === 'vue-compat'),
        __FEATURE_SUSPENSE__: `true`,
        __FEATURE_OPTIONS_API__: `true`,
        __FEATURE_PROD_DEVTOOLS__: `false`,
        __FEATURE_PROD_HYDRATION_MISMATCH_DETAILS__: `false`,
      },
    })
    .then(ctx => ctx.watch())
}
