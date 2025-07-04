import { authGuard } from "@analog-tools/auth/angular";
import { RouteMeta } from "@analogjs/router";
import { Component } from "@angular/core";

export const routeMeta: RouteMeta = {
    title: "Test Page",
    canActivate: [authGuard]
}

@Component({
  selector: 'analog-example-test',
  standalone: true,
  imports: [],
  template: ` Hallo `,
})
export default class TestComponent {}
