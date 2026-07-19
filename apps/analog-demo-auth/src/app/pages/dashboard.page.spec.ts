import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@analog-tools/auth/angular';
import DashboardPageComponent, { routeMeta } from './dashboard.page';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let authService: Pick<
    AuthService,
    'isAuthenticationLoading' | 'isAuthenticated' | 'login' | 'logout' | 'user'
  >;

  beforeEach(() => {
    authService = {
      isAuthenticationLoading: signal(false),
      isAuthenticated: signal(false),
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
  });

  it('creates the dashboard component', () => {
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('declares authGuard route protection metadata', () => {
    expect(routeMeta).toMatchObject({
      title: 'Dashboard',
    });

    expect('canActivate' in routeMeta).toBe(true);
  });
});
