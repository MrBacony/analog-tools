import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="home">
      <h1>Analog Auth Demo</h1>
      <p>Demo app for <code>@analog-tools/auth</code> integration.</p>
      <nav>
        <a routerLink="/dashboard">Dashboard (protected)</a> |
        <a routerLink="/info">Info (public)</a>
      </nav>
    </div>
  `,
})
export default class HomeComponent {}
