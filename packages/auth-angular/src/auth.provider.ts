import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthService } from './auth.service';

export function provideAuthClient(): EnvironmentProviders {
  return makeEnvironmentProviders([AuthService]);
}
