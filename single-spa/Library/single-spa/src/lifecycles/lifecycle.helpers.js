import { find } from "../utils/find.js";
import { objectType, toName } from "../applications/app.helpers.js";
import { formatErrorMessage } from "../applications/app-errors.js";

export function validLifecycleFn(fn) {
  return fn && (typeof fn === "function" || isArrayOfFns(fn));

  function isArrayOfFns(arr) {
    return (
      Array.isArray(arr) && !find(arr, (item) => typeof item !== "function")
    );
  }
}

/**
 * 返回一个接受props作为参数的函数
 * 函数执行子应用中的生命周期函数
 * 并确保生命周期函数返回的是一个promise
 * @param {*} appOrParcel window.singleSpa 子应用打包后的对象
 * @param {*} lifecycle string，生命周期名称
 * @returns 
 */
export function flattenFnArray(appOrParcel, lifecycle) {
  // fns = fn | []
  let fns = appOrParcel[lifecycle] || [];
  // fns = [fn] | [] 转化成array
  fns = Array.isArray(fns) ? fns : [fns];
  // 如果为空：有些生命周期子应用未设置，如unload
  if (fns.length === 0) {
    fns = [() => Promise.resolve()];
  }

  const type = objectType(appOrParcel);
  const name = toName(appOrParcel);

  return function (props) {
    // 返回一个promise链
    return fns.reduce((resultPromise, fn, index) => {
      return resultPromise.then(() => {
        const thisPromise = fn(props);
        // 执行生命周期函数，传递props，验证返回结果 => 必须为promise
        return smellsLikeAPromise(thisPromise)
          ? thisPromise
          : Promise.reject(
              formatErrorMessage(
                15,
                __DEV__ &&
                  `Within ${type} ${name}, the lifecycle function ${lifecycle} at array index ${index} did not return a promise`,
                type,
                name,
                lifecycle,
                index
              )
            );
      });
    }, Promise.resolve());
  };
}

// 简单判断是不是promise
export function smellsLikeAPromise(promise) {
  return (
    promise &&
    typeof promise.then === "function" &&
    typeof promise.catch === "function"
  );
}
