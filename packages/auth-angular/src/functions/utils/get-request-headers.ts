import { HttpHeaders } from '@angular/common/http';
import { ServerRequest } from '@analogjs/router/tokens';

export function getRequestHeaders(
  serverRequest: ServerRequest | null,
  originalHeaderValues?: { [key: string]: string | null | undefined }
) {
  let headers = new HttpHeaders();
  headers = headers.set('fetch', 'true');

  if (originalHeaderValues) {
    Object.entries(originalHeaderValues).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        headers = headers.set(key, value);
      }
    });
  }

  if (serverRequest) {
    Object.entries(serverRequest.headers).forEach(([key, value]) => {
      if (value !== null && value !== undefined && typeof value === 'string') {
        headers = headers.set(key, value);
      }
    });
  }
  return headers;
}
