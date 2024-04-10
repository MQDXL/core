// const arr = [1,2,3]
// Object.defineProperty(arr,'length',{
//     set(value){
//         console.log('set length', value);
//         this.length = value;
//     },
//     get(){
//         console.log('get length' )
//         return this.length
//     }
// })
// // 会报错，应为length是不能被重定义的。
// arr.push(111)
// proxy 拦截的是所以得基本操作，
// Object.defineProperty只是出发[[DefineOwnProperty]]这个内部操作，不能触发其他内部操作，不能被拦截相应的操作
// 例如：针对数组，vue2就很难拦截，vue2就是重写了Array的相应方法，

const arr = [1, 2, 3]
const p = new Proxy(arr, {
  set(target, prop, value) {
    console.log('set', prop, value)
    target[prop] = value
    return true
  },
  get(target, prop) {
    console.log('get', prop)
    return target[prop]
  },
})
// get push
// get length
// set 3 111  在位置3上添加111
// set length 4
p.push(111)
