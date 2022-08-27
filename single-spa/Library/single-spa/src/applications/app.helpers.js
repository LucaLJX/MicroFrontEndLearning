import { handleAppError } from "./app-errors.js";

// App statuses
export const NOT_LOADED = "NOT_LOADED"; // 未加载/待加载
export const LOADING_SOURCE_CODE = "LOADING_SOURCE_CODE"; // 加载源码
export const NOT_BOOTSTRAPPED = "NOT_BOOTSTRAPPED"; // 未启动/待启动
export const BOOTSTRAPPING = "BOOTSTRAPPING"; // 启动中
export const NOT_MOUNTED = "NOT_MOUNTED"; // 未挂载/待挂载
export const MOUNTING = "MOUNTING"; // （子应用）挂载中
export const MOUNTED = "MOUNTED"; // （子应用）已挂载
export const UPDATING = "UPDATING"; // 更新中
export const UNMOUNTING = "UNMOUNTING"; // （子应用）卸载中
export const UNLOADING = "UNLOADING"; // （子应用）移除中
export const LOAD_ERROR = "LOAD_ERROR"; // 加载错误
export const SKIP_BECAUSE_BROKEN = "SKIP_BECAUSE_BROKEN"; // 用户错误

/**
 * 判断子应用是否激活（已挂载）
 * @param {*} app
 * @returns
 */
export function isActive(app) {
  return app.status === MOUNTED;
}

/**
 * 判断当前app是否需要激活（是否需要挂载）
 * @param {*} app 
 * @returns 
 */
export function shouldBeActive(app) {
  try {
    return app.activeWhen(window.location);
  } catch (err) {
    handleAppError(err, app, SKIP_BECAUSE_BROKEN);
    return false;
  }
}

export function toName(app) {
  return app.name;
}

// 一个single-spa 的 parcel，指的是一个与框架无关的组件，由一系列功能构成，可以被应用手动挂载，无需担心由哪种框架实现。Parcels 和注册应用的api一致，不同之处在于parcel组件需要手动挂载，而不是通过activity方法被激活。
export function isParcel(appOrParcel) {
  return Boolean(appOrParcel.unmountThisParcel);
}

/**
 * 判断是“应用”还是“parcel”
 * @param {*} appOrParcel 
 * @returns 
 */
export function objectType(appOrParcel) {
  return isParcel(appOrParcel) ? "parcel" : "application";
}
