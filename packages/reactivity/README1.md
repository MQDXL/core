- npm  有'幽灵依赖'问题 例如：项目中使用 bootstrap, 其中bootstrap 依赖了animate.css，我们在项目中可以使用 animate.css
       但是在我们删除bootstrap 时候，animate.css 就也删除了
- pnpm 默认没有 幽灵依赖 ， pnpm 不能使用bootstrap的依赖animate.css 
       更改这个默认行为，可以在.npmrc 文件中添加 shamefully-hoist = true

``` json
"buildOptions": {
    "name": "Vue",  // window下挂载的属性名
    "formats": [
      "esm-bundler",
      "esm-bundler-runtime",
      "cjs",
      "global",
      "global-runtime",
      "esm-browser",
      "esm-browser-runtime"
    ]
  },
```
``` json
    {
        "name": "@vue/shared",
        "version": "1.0.0",
        "unpkg":"dist/shared.global.js", // 浏览器引用
        "main": "dist/shared.cjs.js",    // node引用
        "module": "dist/shared.esm.js",  // es6（webpack）引用
        "buildOptions": {                // 自定义的选项
            "formats": [
                "esm-bundler",
                "cjs"
            ]
        }
    } 

```
- 各个包相互依赖问题： 在ractivity中引用shared 的导出，需要配置 tsconfig.json的别名
``` json
    {
        "compilerOptions": {
            "outDir": "dist", // 输出的目录
            "sourceMap": true, // 采用sourcemap
            "target": "es2016", // 目标语法
            "module": "esnext", // 模块格式
            "moduleResolution": "node", // 模块解析方式
            "strict": false, // 严格模式 false 可以使用any
            "resolveJsonModule": true, // 解析json模块
            "esModuleInterop": true, // 允许通过es6语法引入commonjs模块
            "jsx": "preserve", // jsx 不转义
            "lib": ["esnext", "dom"],      // 支持的类库 esnext及dom
            "baseUrl": ".",                // 在根目录下查找
            "paths":{
                "@vue/*":["packages/*/src/"]   // 
            }
        }
    }
```
- 在 reactivity模块中添加本地shared模块依赖 pnpm install @vue/shared@workspace --filter @vue/reactivity
- const { reactive, effect } from "vue";
- effect(()=>{}) effect 回调函数会知错能改一次，后续数据变化了，会再次执行，

- vue 中proxy 问题: 
``` js

    let person = {
        name:"zh",
        get aliasName(){
            // this指向person
            return this.name +"jg"
        }
    }
    const proxy = new Proxy(person,{
        get(target, key, receiver) {
            return target[key]
        }
    })
    proxy.aliasName

```

- 改成 Reflext.get
``` js
    let person = {
        name:"zh",
        get aliasName(){
            // this 指向 proxy
            return this.name +"jg"
        }
    }
    const proxy = new Proxy(person,{
        get(target, key, receiver) {
            //get(target, key, receiver) 此处的receiver 是 proxy or 继承 proxy的实例
            // Reflect.get(target, key, receiver) receiver 是person中aliasName中的this(指向reflece.get传入的receiver),
            return Reflect.get(target, key, receiver)
        },
    })
    /*** 打印结果
    */
    console.log(proxy.aliasName)

```

- WeakMap 
    V8 垃圾回收机制： 标记删除 引用计数，WeakMap 不会被引用计数，所以不会有内存泄漏
- 循环调用问题: 结局：1、[activeEffect1,activeEffect2] vue2就是这么解决的
                     2、 activeEffect1.parent = null activeEffect2.parent = activeEffect1
``` js
    effect(()=>{ // activeEffect 问题
        state.name; // 此时 activeEffect1
        effect(()=>{
            state.age; // 此时 activeEffect2
        })
        state.address;
    })
```
- 无线循环问题：
``` js
    let effect = () => {};
    let s = new Set([effect])
    s.forEach(item=>{s.delete(effect); s.add(effect)}); // 这样就导致死循环了
```
``` js
    let effect = () => {};
    let s = new Set([effect])
    let s2 = new Set(s)
    // 遍历就执行一次
    s2.forEach(item=>{s.delete(effect); s.add(effect)}); // 这样就结局死循环了
```
- 位运算
```js
export const enum ShapeFlags {
    ELEMENT = 1,
    FUNCTIONAL_COMPONENT = 1 << 1,
    STATEFUL_COMPONENT = 1 << 2,
    TEXT_CHILDREN = 1 << 3,
    ARRAY_CHILDREN = 1 << 4,
    SLOTS_CHILDREN = 1 << 5,
    TELEPORT = 1 << 6,
    SUSPENSE = 1 << 7,
    COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,
    COMPONENT_KEPT_ALIVE = 1 << 9,
    COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}
```
权限的组合可以采用 | 的方式， 每一个用户(001)是前一个用户的左移形成新的用户(010)
001 = 1 用户
010 = 2 管理员
100 = 4 超级管理员
例如： 一个人 是 用户跟管理员  001|010 = 011
可以用 
011 & 001 > 0 说明包含用户
011 & 010 > 0 说明包含管理员
011 & 100 =0 说明不包含超级挂利用

- vue 源码遇到的问题，
- 例子1
``` js
    effect(()=>{ // activeEffect 问题
        state.name; // 此时 activeEffect1
        effect(()=>{
            state.age; // 此时 activeEffect2
        })
        state.address;
    })
```
- 例子2
```js
    const {reactive, effect} = VueReactivity
    const state = reactive({ flag: true, name: 'jw', age: 30 })
    effect(() => { // 副作用函数 (effect执行渲染了页面)
        console.log('render')
        document.body.innerHTML = state.flag ? state.name : state.age
    });
    setTimeout(() => {
        state.flag = false;
        setTimeout(() => {
            console.log('此时，effect中并没有使用name,修改name不应该更新effect')
            state.name = 'zf'
        }, 1000);
    }, 1000)
```
- 例子2-2
``` js
    effect(()=>{
        state.age = 100;
        app.innerHtml = state.name +','+ state.age; 
    })
    setTimeout(()=>{
        state.age++; 
    })
```


- 例子3
``` js
    const {reactive, effect} = VueReactivity
    const state = reactive({ flag: true, name: 'jw', age: 30 })
    const runner = effect(() => { // 副作用函数 (effect执行渲染了页面)
        document.body.innerHTML = state.flag 
    });
    // 调用之后，改变flag 就不更新effect了
    runner.effect.stop();
    setTimeout(() => {
        state.flag = false;
        // runner.effect.stop() 调用之后，改变flag,如果还想更新effect,可以调用runner()手动更新
        // 此时的active 是false, flag 的effect Set 中没有此effect,再次改变 flag, runner 对应的effect不更新，需要再次调用runner
    }, 1000)
```
- 例子4 批量更新
``` js
    const {reactive, effect} = VueReactivity
    let waiting = false
    const state = reactive({ flag: true, name: 'jw', age: 30 })
    const runner = effect(() => { // 副作用函数 (effect执行渲染了页面)
        document.body.innerHTML = state.age
    },{
        scheduler(){
            // 传入scheduler,每次state.age++都会执行scheduler函数
            if(!waiting){
                waiting = true;
                Promise.resolve().then(()=>{
                    // 重新收集依赖
                    runner();
                })
            }
        }
    });
    setTimeout(() => {
        state.age++;
        state.age++;
        state.age++;
        state.age++;
    }, 1000)
```
- 例子5
```js
    const {reactive, effect} = VueReactivity
    const state = reactive({ firstName: 'l'})
    let fullName = computed(()=>{
        return state.firstName
    })
    effect(()=>{
        // 只有fullName取值了，computed的回调才会执行
        app.innerHTML = fullName.value;
    })

    setTimeout(()=>{
        state.firstName = "路"
    })
```
- 例子6 使用watch 监听输入框的值，去请求数据，有一个bug：
        假设 发送了三个请求 A(3s)   B(1s)   C(1s) 这个时候，A请求最后请求成功，页面渲染的是A请求的数据
        这就出现问题;
```js
 const state = reactive({ flag: true, name: 'jw', age: 30 })
let i = 2000;
function getData(timer){
    return new Promise((resolve,reject)=>{
        setTimeout(() => {
            resolve(timer)
        }, timer);
    })
}
// 调用watch回调函数时，会将上一次的 onCleanup的回调函数执行，
watch(()=>state.age,async (newValue,oldValue,onCleanup)=>{
    // 使用了闭包，第二次执行时，会指向上一次的onCleanup,
    // 使上一次的clear为true,不能更新UI  此情况是 上一次请求还未成功
    let clear = false;
    onCleanup(()=>{
        clear = true;
    })
    i-=1000;
    let r =  await getData(i); // 第一次执行1s后渲染1000， 第二次执行0s后渲染0， 最终应该是0
    if(!clear){document.body.innerHTML = r;}
},{flush:'sync'});
state.age = 31;
state.age = 32;


```
- 例7 watch的使用  watch的回调执行是异步的，如果想改成同步的使用 flush:'sync'
```js
    watch(state,(oldValue,newValue)=>{ // 监测一个响应式值的变化
        // 监控整个state,state中的任意属性改变，就会执行回调，oldValue===newValue 两者是相等的
       console.log(oldValue,newValue)
    })
    watch(()=>state.age,(oldValue,newValue)=>{ // 监测一个响应式值的变化
       console.log(oldValue,newValue)
    })
    watchEffect(()=>{
        app.innerHTML = state.age
    },{flush: 'sync'})
```
```js 响应式丢失
const state = reactive({name: 'jw', age: 30 })
let person = {...state}
effect(()=>{
    document.body.innerHTML = person.name +'今年' + person.age +'岁了'
})
setTimeout(()=>{
    person.age = 31;
},1000)
```
```js toRefs可以这么保持响应式
const state = reactive({name: 'jw', age: 30 })
// toRef使用 const name =  toRef(state, 'name')
// const age = toRef(state,'age')
const {name, age} = toRefs(state)
effect(()=>{
    document.body.innerHTML = name.value +'今年' + age.value +'岁了'
})
setTimeout(()=>{
    age.value = 100;
},1000)
```

