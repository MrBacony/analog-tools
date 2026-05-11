import { Component } from '@angular/core';

@Component({
  selector: 'app-info',
  template: `
    <div class="info">
      <h1>Info</h1>
      <p>This is a public page accessible without authentication.</p>
      <p>
        The demo app demonstrates <code>@analog-tools/auth</code> integration
        with AnalogJS including OAuth/OIDC login, route protection, and session
        management.
      </p>
    </div>
  `,
})
export default class InfoPageComponent {}
