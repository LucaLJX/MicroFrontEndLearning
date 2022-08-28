import { reroute } from "./navigation/reroute.js";
import { formatErrorMessage } from "./applications/app-errors.js";
import { setUrlRerouteOnly } from "./navigation/navigation-events.js";
import { isInBrowser } from "./utils/runtime-environment.js";

let started = false;

/**
 * 启动
 * 调用start之前，应用会被加载
 * 但是不会被初始化、挂载、卸载，这样可以更好的控制应用的性能
 * @param {*} opts 
 */
export function start(opts) {
  started = true;
  // urlRerouteOnly: A boolean that defaults to false. If set to true, calls to history.pushState() and history.replaceState() will not trigger a single-spa reroute unless the client side route was changed.
  if (opts && opts.urlRerouteOnly) {
    setUrlRerouteOnly(opts.urlRerouteOnly);
  }
  if (isInBrowser) {
    reroute();
  }
}

export function isStarted() {
  return started;
}

if (isInBrowser) {
  // 应用如果被注册之后，5000ms内没有被启动，则会告警
  setTimeout(() => {
    if (!started) {
      console.warn(
        formatErrorMessage(
          1,
          __DEV__ &&
            `singleSpa.start() has not been called, 5000ms after single-spa was loaded. Before start() is called, apps can be declared and loaded, but not bootstrapped or mounted.`
        )
      );
    }
  }, 5000);
}
