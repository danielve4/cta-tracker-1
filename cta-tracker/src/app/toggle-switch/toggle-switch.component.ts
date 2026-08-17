import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

/** A plain on/off switch. The theme toggle keeps its own icon-bearing variant. */
@Component({
  selector: 'app-toggle-switch',
  templateUrl: './toggle-switch.component.html',
  styleUrls: ['./toggle-switch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToggleSwitchComponent {
  readonly checked = input.required<boolean>();
  readonly label = input('');
  readonly toggled = output<void>();
}
