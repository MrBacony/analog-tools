---
applyTo: '**/*.spec.ts'
---

# Vitest Testing Standards for Angular & AnalogJS

This guide outlines best practices for writing maintainable, reliable, and performant tests with Vitest in Angular/AnalogJS projects. It provides practical examples and standards to ensure consistent testing quality.

## Table of Contents

1. [Test Organization](#1-test-organization)
2. [Angular-Specific Testing Practices](#2-angular-specific-testing-practices)
3. [Testing Patterns](#3-testing-patterns)
4. [Mocking and Stubbing](#4-mocking-and-stubbing)
5. [Performance and Optimization](#5-performance-and-optimization)
6. [Common Pitfalls](#6-common-pitfalls)
7. [Test Setup and Configuration](#7-test-setup-and-configuration)

## 1. Test Organization

### Directory Structure

Place test files alongside the component or module they test:

```
src/
  components/
    user.component.ts
    user.component.spec.ts
  services/
    auth.service.ts
    auth.service.spec.ts
```

### File Naming and Structure

- Use `.spec.ts` suffix for test files
- Group related tests with descriptive `describe` blocks
- Write test cases with clear `it` statements that indicate expected behavior

```typescript
// auth.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  
  beforeEach(() => {
    service = new AuthService();
  });
  
  describe('authentication', () => {
    it('should authenticate with valid credentials', async () => {
      // Test implementation
    });
    
    it('should reject invalid credentials', async () => {
      // Test implementation
    });
  });
  
  describe('authorization', () => {
    it('should check user permissions', () => {
      // Test implementation
    });
  });
});
```

### Test Organization Best Practices

1. **Use descriptive names**: Test descriptions should clearly communicate what's being tested
2. **Follow AAA pattern**: Structure tests with Arrange, Act, Assert sections
3. **Keep tests independent**: Each test should be executable in isolation
4. **Test one thing per test case**: Focus on a single behavior or outcome

## 2. Angular-Specific Testing Practices

### Testing Components

Use Angular's TestBed to configure the testing environment:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let component: MyComponent;
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // For standalone components
      // declarations: [MyComponent], // For non-standalone components
    }).compileComponents();

    fixture = TestBed.createComponent(MyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  
  it('should display title correctly', () => {
    component.title = 'Test Title';
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('h1').textContent).toContain('Test Title');
  });
});
```

### Testing Services

Test services with proper dependency injection:

```typescript
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { HttpClient } from '@angular/common/http';

describe('AuthService', () => {
  let service: AuthService;
  let httpClient: jasmine.SpyObj<HttpClient>;
  
  beforeEach(() => {
    const spy = vi.fn();
    
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: HttpClient, useValue: { get: spy } }
      ]
    });
    
    service = TestBed.inject(AuthService);
    httpClient = TestBed.inject(HttpClient) as jasmine.SpyObj<HttpClient>;
  });
  
  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

### Testing Angular Signals

Modern approach for testing signals in Angular v17+:

```typescript
import { TestBed } from '@angular/core/testing';
import { CounterService } from './counter.service';

describe('CounterService', () => {
  let service: CounterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CounterService);
  });

  it('should increment counter', () => {
    // Initial value
    expect(service.count()).toBe(0);
    
    // Act
    service.increment();
    
    // Assert new signal value
    expect(service.count()).toBe(1);
  });
  
  it('should update computed signals', () => {
    // Act
    service.setValue(10);
    
    // Assert computed signal value
    expect(service.doubled()).toBe(20);
  });
});
```

### Testing HTTP Requests

Test HttpClient calls using Angular's HttpClientTestingModule:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { User } from './user.model';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [UserService]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch users', () => {
    const mockUsers: User[] = [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' }
    ];

    service.getUsers().subscribe(users => {
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });
});
```

### Testing Guards and Interceptors

Example of testing an auth guard:

```typescript
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { expect, vi } from 'vitest';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const authSpy = vi.fn();
    const routerSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: authSpy } },
        { provide: Router, useValue: { navigate: routerSpy } }
      ]
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should allow access when user is authenticated', () => {
    authService.isAuthenticated.mockReturnValue(true);
    const result = authGuard();
    expect(result).toBe(true);
  });

  it('should redirect to login when user is not authenticated', () => {
    authService.isAuthenticated.mockReturnValue(false);
    const result = authGuard();
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
```

## 3. Testing Patterns

### AAA Pattern (Arrange-Act-Assert)

Structure tests with clear sections:

```typescript
it('should calculate total price correctly', () => {
  // Arrange
  const cart = new ShoppingCart();
  cart.addItem({ id: 1, price: 10 });
  cart.addItem({ id: 2, price: 15 });
  
  // Act
  const total = cart.calculateTotal();
  
  // Assert
  expect(total).toBe(25);
});
```

### Testing Asynchronous Code

Use `async/await` with Vitest's matchers:

```typescript
it('should resolve with user data', async () => {
  // Using direct async/await
  const user = await userService.getUserById(1);
  expect(user).toEqual({ id: 1, name: 'John' });
  
  // Or using .resolves matcher
  await expect(userService.getUserById(1))
    .resolves.toEqual({ id: 1, name: 'John' });
});

it('should handle rejection properly', async () => {
  // Test for rejection
  await expect(userService.getUserById(999))
    .rejects.toThrow('User not found');
});
```

### Testing Error Handling

Verify errors are caught and handled correctly:

```typescript
it('should handle API errors gracefully', async () => {
  // Arrange
  const errorMessage = 'Network error';
  mockHttpClient.get.mockRejectedValue(new Error(errorMessage));
  
  // Act & Assert
  await expect(service.fetchData())
    .rejects.toThrow(errorMessage);
    
  // Or test the error handling mechanism
  const result = await service.fetchDataSafely();
  expect(result.error).toBe(errorMessage);
  expect(result.data).toBeNull();
});
```

## 4. Mocking and Stubbing

### Using vi.mock() for Dependency Mocking

```typescript
// Mocking modules
vi.mock('./config', () => ({
  default: { apiUrl: 'http://test-api.com' },
  timeout: 1000
}));

// Mocking specific functions
vi.mock('./auth-service', () => ({
  login: vi.fn().mockResolvedValue({ token: 'fake-token' }),
  logout: vi.fn().mockResolvedValue(true)
}));
```

### Spies with vi.spyOn()

```typescript
import { describe, it, expect, vi } from 'vitest';
import { UserService } from './user.service';
import { Logger } from './logger';

describe('UserService', () => {
  it('should log error when user fetch fails', async () => {
    // Create spy on Logger.error method
    const errorSpy = vi.spyOn(Logger, 'error');
    
    // Force the API call to fail
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('API error'));
    
    // Execute the method under test
    const service = new UserService();
    await service.getUser(1);
    
    // Verify the error was logged
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch user', expect.any(Error));
  });
});
```

### Mocking Angular Services

Use custom instances or TestBed providers:

```typescript
// Using custom instances
import { registerService } from '@analog-tools/inject';

describe('AuthComponent', () => {
  let mockAuthService: Partial<AuthService>;
  
  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined)
    };
    
    registerService(AuthService, mockAuthService);
  });
  
  // Tests...
});

// Or using TestBed
describe('AuthComponent', () => {
  let component: AuthComponent;
  let authService: AuthService;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: vi.fn().mockReturnValue(true),
            login: vi.fn().mockResolvedValue(undefined)
          }
        }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(AuthComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
  });
  
  // Tests...
});
```

### Using Mock Implementations

Create reusable mock implementations:

```typescript
import { MockLoggerService } from '@analog-tools/logger';

describe('MyService', () => {
  let service: MyService;
  let mockLogger: MockLoggerService;
  
  beforeEach(() => {
    mockLogger = new MockLoggerService();
    registerCustomServiceInstance(LoggerService, mockLogger);
    
    // Spy on logger methods
    vi.spyOn(mockLogger, 'info');
    vi.spyOn(mockLogger, 'error');
    
    service = new MyService();
  });
  
  it('should log operation details', () => {
    service.performOperation();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Operation completed', 
      expect.objectContaining({ status: 'success' })
    );
  });
});
```

## 5. Performance and Optimization

### Running Tests Efficiently

Configure Vitest for better performance:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    threads: true,         // Run tests in parallel
    isolate: true,         // Run tests in isolation
    maxThreads: 4,         // Limit number of threads
    minThreads: 1,
    coverage: {
      provider: 'v8',      // Better coverage reporting
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage'
    }
  }
});
```

### Efficient Test Setup

Use test lifecycle hooks properly:

```typescript
describe('UserService', () => {
  // Setup done once for all tests in this suite
  beforeAll(() => {
    // Initialize expensive resources
    initializeDatabase();
  });
  
  // Setup before each test
  beforeEach(() => {
    // Reset state for each test
    resetUserData();
  });
  
  // Cleanup after each test
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  // Cleanup after all tests
  afterAll(() => {
    // Release expensive resources
    closeDatabase();
  });
  
  // Tests...
});
```

### Mocking Expensive Operations

Replace expensive operations with lightweight mocks:

```typescript
// Instead of real HTTP calls
vi.mock('node-fetch');

// Instead of filesystem operations
vi.mock('fs/promises');

// Instead of complex computations
vi.mock('./image-processor', () => ({
  processImage: vi.fn().mockResolvedValue('processed-image-url')
}));
```

## 6. Common Pitfalls

### Avoiding Brittle Tests

Focus on behavior, not implementation details:

```typescript
// ❌ BAD: Testing implementation details
it('should call the API with correct parameters', () => {
  const spy = vi.spyOn(service.client, 'get');
  service.fetchUsers();
  expect(spy).toHaveBeenCalledWith('/api/users');
});

// ✅ GOOD: Testing observable behavior
it('should return users from the API', async () => {
  const users = await service.fetchUsers();
  expect(users.length).toBeGreaterThan(0);
  expect(users[0]).toHaveProperty('id');
});
```

### Common Issues to Avoid

1. **Over-mocking**: Only mock what's necessary
2. **Flaky tests**: Avoid tests that are dependent on timing or external state
3. **Test pollution**: Ensure tests don't affect each other
4. **Large setup blocks**: Keep setup concise and focused

### Edge Case Testing

Always test edge cases and error conditions:

```typescript
describe('divide function', () => {
  it('should divide two numbers correctly', () => {
    expect(divide(10, 2)).toBe(5);
  });
  
  it('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
  });
  
  it('should handle decimal results', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 3);
  });
  
  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
    expect(divide(10, -2)).toBe(-5);
    expect(divide(-10, -2)).toBe(5);
  });
});
```

## 7. Test Setup and Configuration

### Setting Up Angular Tests

Proper test setup for AnalogJS projects:

```typescript
// src/test-setup.ts
import '@analogjs/vitest-angular/setup-zone';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);
```

### Vitest Configuration for Angular

Optimized configuration for Angular/AnalogJS projects:

```typescript
// vite.config.ts or vitest.config.ts
export default defineConfig(() => ({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    coverage: {
      reportsDirectory: '../../coverage/packages/my-package',
      provider: 'v8'
    }
  }
}));
```

### Using Specific Tools

1. **Code Coverage Tools**: Configure and analyze coverage reports
2. **Snapshot Testing**: Use with caution for UI components
3. **Test Utilities**: Leverage Angular's testing utilities

### CI/CD Integration

Integrate testing in your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow snippet
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/
```
