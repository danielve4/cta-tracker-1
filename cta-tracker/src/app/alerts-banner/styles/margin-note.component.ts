import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AlertStyleBase } from './alert-style.base';
import { AlertDetailComponent } from './alert-detail.component';

/**
 * No box at all: a hairline rule in the tone colour, a small-caps kicker, a serif headline and an
 * inline "Read more", like a note in the margin of a page. Notes fold into one quiet line.
 */
@Component({
  selector: 'app-alert-margin-note',
  templateUrl: './margin-note.component.html',
  styleUrls: ['./alert-styles-shared.css', './margin-note.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, AlertDetailComponent]
})
export class MarginNoteComponent extends AlertStyleBase {
  /** "Elevator at 69th, Bus stop relocated…" for the folded notes line. */
  notesPreview(headlines: string[]): string {
    return headlines.join(', ');
  }

  headlinesOf(alerts: { headline: string }[]): string[] {
    return alerts.map(a => a.headline);
  }
}
