import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@analog-tools/auth/angular';
import DashboardPageComponent from './dashboard.page';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let isAuthenticationLoading: ReturnType<typeof signal<boolean>>;
  let isAuthenticated: ReturnType<typeof signal<boolean>>;
  let authService: Pick<
    AuthService,
    'isAuthenticationLoading' | 'isAuthenticated' | 'login' | 'logout' | 'user'
  >;

  beforeEach(() => {
    vi.useFakeTimers();
    isAuthenticationLoading = signal(true);
    isAuthenticated = signal(false);

    authService = {
      isAuthenticationLoading,
      isAuthenticated,
      login: vi.fn(),
      logout: vi.fn(),
      user: signal(null),
    } as Pick<
      AuthService,
      'isAuthenticationLoading' | 'isAuthenticated' | 'login' | 'logout' | 'user'
    >;

    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    });

    fixture = TestBed.createComponent(DashboardPageComponent);
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('clears the previous login timer before scheduling another one', () => {
    fixture.detectChanges();

    isAuthenticationLoading.set(false);
    fixture.detectChanges();

    isAuthenticationLoading.set(true);
    fixture.detectChanges();
    isAuthenticationLoading.set(false);
    fixture.detectChanges();

    vi.advanceTimersByTime(3000);

    expect(authService.login).toHaveBeenCalledTimes(1);
  });

  it('clears pending login timer when destroyed', () => {
    fixture.detectChanges();

    isAuthenticationLoading.set(false);
    fixture.detectChanges();

    fixture.destroy();
    vi.advanceTimersByTime(3000);

    expect(authService.login).not.toHaveBeenCalled();
  });
});
