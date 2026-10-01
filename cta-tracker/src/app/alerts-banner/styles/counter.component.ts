import { Component, ChangeDetectionStrategy, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertStyleBase } from './alert-style.base';
import { AlertGlyphComponent } from './alert-glyph.component';
import { AlertDetailComponent } from './alert-detail.component';

/**
 * Just a count, pinned to the top-right of the stop header beside the station name. Tapping it
 * opens a card anchored under it, its caret pointing back at the button. It closes on the button,
 * Esc, or a tap anywhere else.
 *
 * Positioned against `.stop-header` (which is `position: relative`); the parent keeps the station
 * name clear of it with a `:has()` rule on this component's host attributes.
 */
@Component({
  selector: 'app-alert-counter',
  templateUrl: './counter.component.html',
  styleUrls: ['./alert-styles-shared.css', './counter.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertGlyphComponent, AlertDetailComponent]
})
export class CounterComponent extends AlertStyleBase {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');
  /** Distance from the card's right edge to the caret's centre: the middle of the button. */
  readonly caretRight = signal(24);

  open(): void {
    const width = this.button()?.nativeElement.offsetWidth;
    if (width) {
      this.caretRight.set(width / 2);
    }
    this.toggle();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.expanded() && !this.host.nativeElement.contains(event.target as Node)) {
      this.expanded.set(false);
    }
  }

  protected override onEscape(): void {
    if (this.expanded()) {
      this.expanded.set(false);
      this.button()?.nativeElement.focus();
    }
  }
}
