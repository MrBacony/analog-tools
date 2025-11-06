import { Component } from '@angular/core';

import { AnalogWelcomeComponent } from './analog-welcome.component';
import { authGuard } from '@analog-tools/auth/angular';
import { RouteMeta } from '@analogjs/router';

export const routeMeta: RouteMeta = {
  title: 'HomePage',
  canActivate: [authGuard],
};

@Component({
  selector: 'analog-example-analdog-welcome-page',

  imports: [AnalogWelcomeComponent],
  template: ` <analog-example-analog-welcome /> `,
})
export default class AnalogWelcomePage {}
