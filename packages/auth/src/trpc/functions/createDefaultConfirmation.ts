import { TRPCErrorData } from '../types/trpc';

function confirmDialog(msg:string) {
    return new Promise(function (resolve, reject) {
      if(!window?.confirm) {
        console.error("confirm is not available");
        return reject(false);
      }
      const confirmed = confirm(msg);

      return confirmed ? resolve(true) : reject(false);
    });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createDefaultConfirmation(_: TRPCErrorData | undefined): boolean {
  confirmDialog("Session expired. Do you want to refresh the page?").then(() => {
      window.location.href = '/';
  });
  return true;
}
