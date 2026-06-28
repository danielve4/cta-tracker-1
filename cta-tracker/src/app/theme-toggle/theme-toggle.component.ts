import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./theme-toggle.component.css']
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
}
