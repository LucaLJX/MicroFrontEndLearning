import {
  NOT_MOUNTED,
  UNLOADING,
  NOT_LOADED,
  LOAD_ERROR,
  SKIP_BECAUSE_BROKEN,
  toName,
} from "../applications/app.helpers.js";
import { handleAppError } from "../applications/app-errors.js";
import { reasonableTime } from "../applications/timeouts.js";

const appsToUnload = {};

/**
 * 移除应用
 * 1、更改应用的状态
 * 2、执行unload生命周期函数
 * 3、执行清理操作
 * 一般不会执行移除操作，除非手动调用 unloadApplication 方法
 * 一般 unloadInfo 为 undefined，所以第一个if直接return
 * @param {*} app 
 * @returns 
 */
export function toUnloadPromise(app) {
  return Promise.resolve().then(() => {
    // 获取应用信息
    const unloadInfo = appsToUnload[toName(app)];

    if (!unloadInfo) {
      /* No one has called unloadApplication for this app
       */
      /**
       * 不需要移除
       * 一般情况都不需要移除，只有调用 unloadApplication 方法手动移除裁会执行后续内容
       */
      return app;
    }

    // 已经卸载过了，执行清理操作
    if (app.status === NOT_LOADED) {
      /* This app is already unloaded. We just need to clean up
       * anything that still thinks we need to unload the app.
       */
      finishUnloadingApp(app, unloadInfo);
      return app;
    }

    // 如果应用正在执行挂载，路由突然发生改变，那么也需要应用挂载完成才可以执行移除
    if (app.status === UNLOADING) {
      /* Both unloadApplication and reroute want to unload this app.
       * It only needs to be done once, though.
       */
      return unloadInfo.promise.then(() => app);
    }

    if (app.status !== NOT_MOUNTED && app.status !== LOAD_ERROR) {
      /* The app cannot be unloaded until it is unmounted.
       */
      return app;
    }

    // 合理的生命周期时间
    const unloadPromise =
      app.status === LOAD_ERROR
        ? Promise.resolve()
        : reasonableTime(app, "unload");

    app.status = UNLOADING;

    return unloadPromise
      .then(() => {
        finishUnloadingApp(app, unloadInfo);
        return app;
      })
      .catch((err) => {
        errorUnloadingApp(app, unloadInfo, err);
        return app;
      });
  });
}

/**
 * 清理动作，各种删除，然后改变应用的状态 => NOT_LOADED 未加载
 * 移除完成，执行一些清理动作：
 * 1、从appsToUnload数组中移除该app
 * 2、移除生命周期函数
 * 3、更改app.status
 * 但应用不是真的被移除，后面再激活时不需要重新去下载资源,，只是做一些状态上的变更，当然load的那个过程还是需要的，这点可能需要再确认一下
 * @param {*} app 
 * @param {*} unloadInfo 
 */
function finishUnloadingApp(app, unloadInfo) {
  delete appsToUnload[toName(app)];

  // Unloaded apps don't have lifecycles
  delete app.bootstrap;
  delete app.mount;
  delete app.unmount;
  delete app.unload;

  app.status = NOT_LOADED;

  /* resolve the promise of whoever called unloadApplication.
   * This should be done after all other cleanup/bookkeeping
   */
  unloadInfo.resolve();
}

function errorUnloadingApp(app, unloadInfo, err) {
  delete appsToUnload[toName(app)];

  // Unloaded apps don't have lifecycles
  delete app.bootstrap;
  delete app.mount;
  delete app.unmount;
  delete app.unload;

  handleAppError(err, app, SKIP_BECAUSE_BROKEN);
  unloadInfo.reject(err);
}

export function addAppToUnload(app, promiseGetter, resolve, reject) {
  appsToUnload[toName(app)] = { app, resolve, reject };
  Object.defineProperty(appsToUnload[toName(app)], "promise", {
    get: promiseGetter,
  });
}

export function getAppUnloadInfo(appName) {
  return appsToUnload[appName];
}
