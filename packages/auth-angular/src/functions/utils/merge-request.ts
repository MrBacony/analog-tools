import { HttpHeaders, HttpRequest } from '@angular/common/http';
import { ServerRequest } from '@analogjs/router/tokens';

export function mergeRequest(
  originalRequest: HttpRequest<unknown>,
  serverRequest: ServerRequest | null
) {
  let modifiedReq;

  if (serverRequest) {
    let headers = new HttpHeaders();
    Object.entries(serverRequest.headers).forEach(([key, value]) => {
      if (value !== null && value !== undefined && typeof value === 'string') {
        headers = headers.set(key, value);
      }
    });
    headers = headers.set('fetch', 'true');

    modifiedReq = originalRequest.clone({
      headers: headers,
      withCredentials: true,
    });
  } else {
    modifiedReq = originalRequest.clone({
      headers: originalRequest.headers.set('fetch', 'true'),
      withCredentials: true,
    });
  }

  return modifiedReq;
}
