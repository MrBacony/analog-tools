import { authGuard } from "@analog-tools/auth/angular";
import { RouteMeta } from "@analogjs/router";
import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

export const routeMeta: RouteMeta = {
    title: "Test Page",
    canActivate: [authGuard]
}

@Component({
  selector: 'analog-example-test',
  standalone: true,
  imports: [RouterLink],
  template: ` Hallo <br />           <a routerLink="/">Go to Main Page</a>
`,
})
export default class TestComponent {}
