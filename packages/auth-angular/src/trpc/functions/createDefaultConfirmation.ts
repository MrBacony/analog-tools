import { TRPCErrorData } from '../types/trpc';

function confirmDialog(msg:string) {
    return new Promise(function (resolve, reject) {
      try {
        if (!window?.confirm) {
          console.error("confirm is not available");
          return reject(false);
        }
        const confirmed = confirm(msg);

        return confirmed ? resolve(true) : reject(false);
      } catch {
        return reject("Error showing confirmation dialog");
      }
    });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createDefaultConfirmation(_: TRPCErrorData | undefined): boolean {
  confirmDialog("Session expired. Do you want to refresh the page?").then(() => {
      window.location.href = '/';
    // eslint-disable-next-line @typescript-eslint/no-empty-function
  }).catch(() => {});
  return true;
}
