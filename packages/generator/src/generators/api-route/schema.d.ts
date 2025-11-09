export type ApiRouteMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export interface ApiRouteGeneratorSchema {
  route: string;
  project: string;
  method?: ApiRouteMethod;
}
