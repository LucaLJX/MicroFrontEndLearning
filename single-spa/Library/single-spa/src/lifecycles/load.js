import {
  LOAD_ERROR,
  NOT_BOOTSTRAPPED,
  LOADING_SOURCE_CODE,
  SKIP_BECAUSE_BROKEN,
  NOT_LOADED,
  objectType,
  toName,
} from "../applications/app.helpers.js";
import { ensureValidAppTimeouts } from "../applications/timeouts.js";
import {
  handleAppError,
  formatErrorMessage,
} from "../applications/app-errors.js";
import {
  flattenFnArray,
  smellsLikeAPromise,
  validLifecycleFn,
} from "./lifecycle.helpers.js";
import { getProps } from "./prop.helpers.js";
import { assign } from "../utils/assign.js";

/**
 * 通过微任务记载子应用
 * 流程：
 * 1、更改app.status LOAD_SOURCE_CODE => NOT_BOOTSTRAP (LOAD_ERROR)
 * 2、执行加载函数，将props传递给加载函数，给用户处理props的机会
 * 3、验证加载函数的执行结果，必须为promise，且加载函数内部必须return一个对象
 * 4、return的对象必须是子应用的，对象中必须包括各个必须的生命周期函数
 * 5、将生命周期方法通过一个函数包裹，挂载到app对象上
 * 6、app加载完成，删除app.loadPromise
 * @param {*} app 
 * @returns 
 */
export function toLoadPromise(app) {
  return Promise.resolve().then(() => {
    if (app.loadPromise) {
      // app被加载中，直接返回app.loadPromise
      return app.loadPromise;
    }

    // 只有状态为NOT_LOADED和LOAD_ERROR的app才可以被加载
    if (app.status !== NOT_LOADED && app.status !== LOAD_ERROR) {
      return app;
    }

    // 设置App的状态
    app.status = LOADING_SOURCE_CODE;

    let appOpts, isUserErr;

    return (app.loadPromise = Promise.resolve()
      .then(() => {
        // 执行app的加载函数，并给子应用传递props => 用户自定义的customProps和内置的比如应用的名称、singleSpa实例
        // 其实这里有个疑问，这个props是怎么传递给子应用的，感觉跟后面的生命周期函数有关
        const loadPromise = app.loadApp(getProps(app));
        // 判断返回的是不是一个promise
        // 如果不是，报错
        if (!smellsLikeAPromise(loadPromise)) {
          // The name of the app will be prepended to this error message inside of the handleAppError function
          isUserErr = true;
          throw Error(
            formatErrorMessage(
              33,
              __DEV__ &&
                `single-spa loading function did not return a promise. Check the second argument to registerApplication('${toName(
                  app
                )}', loadingFunction, activityFunction)`,
              toName(app)
            )
          );
        }

        // val => 加载函数中return的window.singleSpa,此属性是子应用打包时设置的
        return loadPromise.then((val) => {
          app.loadErrorTime = null;

          // window.singleSpa
          appOpts = val;

          let validationErrMessage, validationErrCode;

          // 进行验证

          // 必须为对象
          if (typeof appOpts !== "object") {
            validationErrCode = 34;
            if (__DEV__) {
              validationErrMessage = `does not export anything`;
            }
          }

          // 必须导出bootstrap生命周期函数
          if (
            // ES Modules don't have the Object prototype
            Object.prototype.hasOwnProperty.call(appOpts, "bootstrap") &&
            !validLifecycleFn(appOpts.bootstrap)
          ) {
            validationErrCode = 35;
            if (__DEV__) {
              validationErrMessage = `does not export a valid bootstrap function or array of functions`;
            }
          }

          // 必须导出mount生命周期函数
          if (!validLifecycleFn(appOpts.mount)) {
            validationErrCode = 36;
            if (__DEV__) {
              validationErrMessage = `does not export a mount function or array of functions`;
            }
          }

          // 必须导出unmount生命周期函数
          if (!validLifecycleFn(appOpts.unmount)) {
            validationErrCode = 37;
            if (__DEV__) {
              validationErrMessage = `does not export a unmount function or array of functions`;
            }
          }

          const type = objectType(appOpts);

          // 判断错误码，一次性抛错
          if (validationErrCode) {
            let appOptsStr;
            try {
              appOptsStr = JSON.stringify(appOpts);
            } catch {}
            console.error(
              formatErrorMessage(
                validationErrCode,
                __DEV__ &&
                  `The loading function for single-spa ${type} '${toName(
                    app
                  )}' resolved with the following, which does not have bootstrap, mount, and unmount functions`,
                type,
                toName(app),
                appOptsStr
              ),
              appOpts
            );
            handleAppError(validationErrMessage, app, SKIP_BECAUSE_BROKEN);
            return app;
          }

          // 合并子应用的devtools属性
          if (appOpts.devtools && appOpts.devtools.overlays) {
            app.devtools.overlays = assign(
              {},
              app.devtools.overlays,
              appOpts.devtools.overlays
            );
          }

          // 设置子应用app的状态为：未初始化，表示已加载完成，待初始化
          app.status = NOT_BOOTSTRAPPED;
          // 在app对象上挂载生命周期方法
          // 每个方法都接收一个props作为参数
          // 方法内部执行子应用导出的生命周期函数
          // 并确保生命周期函数返回一个promise
          app.bootstrap = flattenFnArray(appOpts, "bootstrap");
          app.mount = flattenFnArray(appOpts, "mount");
          app.unmount = flattenFnArray(appOpts, "unmount");
          app.unload = flattenFnArray(appOpts, "unload");
          app.timeouts = ensureValidAppTimeouts(appOpts.timeouts);

          // 子应用成功加载
          // 删除 app.loadPromise 属性
          delete app.loadPromise;

          return app;
        });
      })
      .catch((err) => {
        delete app.loadPromise;

        let newStatus;
        if (isUserErr) {
          newStatus = SKIP_BECAUSE_BROKEN;
        } else {
          newStatus = LOAD_ERROR;
          app.loadErrorTime = new Date().getTime();
        }
        handleAppError(err, app, newStatus);

        return app;
      }));
  });
}
