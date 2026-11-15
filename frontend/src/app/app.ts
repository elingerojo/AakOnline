import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './core/services/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('AakBejuco');

  private readonly analytics = inject(AnalyticsService);

  constructor() {
    // Fire-and-forget: nunca bloquea el arranque ni rompe la app.
    this.analytics.init();
  }
}
