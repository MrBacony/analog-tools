import { RouteMeta } from '@analogjs/router';
import { Component } from '@angular/core';

export const routeMeta: RouteMeta = {
  title: 'Test Page',
};
@Component({
  selector: 'app-test',
  imports: [],
  template: ` Hello from the test page! `,
})
export default class TestComponent {}
