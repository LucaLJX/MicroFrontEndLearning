import {
  UNMOUNTING,
  NOT_MOUNTED,
  MOUNTED,
  SKIP_BECAUSE_BROKEN,
} from "../applications/app.helpers.js";
import { handleAppError, transformErr } from "../applications/app-errors.js";
import { reasonableTime } from "../applications/timeouts.js";

/**
 * 更改状态
 * 执行unmount生命周期函数
 * @param {*} appOrParcel 
 * @param {*} hardFail 
 * @returns 
 */
export function toUnmountPromise(appOrParcel, hardFail) {
  return Promise.resolve().then(() => {
    // 只有mounted的应用，才可以被卸载
    if (appOrParcel.status !== MOUNTED) {
      return appOrParcel;
    }
    // 更改状态
    appOrParcel.status = UNMOUNTING;

    // 如果子应用使用了parcels，则需要对其做一定的处理
    const unmountChildrenParcels = Object.keys(
      appOrParcel.parcels
    ).map((parcelId) => appOrParcel.parcels[parcelId].unmountThisParcel());

    let parcelError;

    return Promise.all(unmountChildrenParcels)
      .then(unmountAppOrParcel, (parcelError) => {
        // There is a parcel unmount error
        return unmountAppOrParcel().then(() => {
          // Unmounting the app/parcel succeeded, but unmounting its children parcels did not
          const parentError = Error(parcelError.message);
          if (hardFail) {
            throw transformErr(parentError, appOrParcel, SKIP_BECAUSE_BROKEN);
          } else {
            handleAppError(parentError, appOrParcel, SKIP_BECAUSE_BROKEN);
          }
        });
      })
      .then(() => appOrParcel);

    function unmountAppOrParcel() {
      // We always try to unmount the appOrParcel, even if the children parcels failed to unmount.
      return reasonableTime(appOrParcel, "unmount")
        .then(() => {
          // The appOrParcel needs to stay in a broken status if its children parcels fail to unmount
          if (!parcelError) {
            appOrParcel.status = NOT_MOUNTED;
          }
        })
        .catch((err) => {
          if (hardFail) {
            throw transformErr(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          } else {
            handleAppError(err, appOrParcel, SKIP_BECAUSE_BROKEN);
          }
        });
    }
  });
}
