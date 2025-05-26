import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideAuthClient } from './auth.provider';
import { AuthService } from './auth.service';
import { expect, describe, it, beforeEach } from 'vitest';

describe('Auth Provider', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideAuthClient()
      ]
    });
  });
  
  it('should provide the AuthService', () => {
    const authService = TestBed.inject(AuthService);
    expect(authService).toBeTruthy();
    expect(authService instanceof AuthService).toBe(true);
  });
});
