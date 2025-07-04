import { Component } from '@angular/core';

import { AnalogWelcomeComponent } from './analog-welcome.component';

@Component({
  selector: 'analog-example-home',
  
  imports: [AnalogWelcomeComponent],
  template: ` <analog-example-analog-welcome /> `,
})
export default class HomeComponent {}
