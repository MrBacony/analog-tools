import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '@analog-tools/auth/angular';
import { appConfig } from './app.config';

const mockServerRequest = {
  headers: {
    cookie: 'auth.session.demo-auth=config-initializer-session-id',
  },
};

vi.mock('@analogjs/router/tokens', () => ({
  injectRequest: vi.fn(() => mockServerRequest),
}));

describe('appConfig', () => {
  const authService = {
    setServerRequest: vi.fn(),
  } as Pick<AuthService, 'setServerRequest'>;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        { provide: AuthService, useValue: authService },
      ],
    });
  });

  it('passes the SSR request to AuthService during environment initialization', () => {
    TestBed.inject(AuthService);

    expect(authService.setServerRequest).toHaveBeenCalledWith(mockServerRequest);
    expect(authService.setServerRequest).toHaveBeenCalledTimes(1);
  });
});
