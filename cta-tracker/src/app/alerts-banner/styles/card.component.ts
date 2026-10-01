import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { AlertStyleBase } from './alert-style.base';
import { AlertDetailComponent } from './alert-detail.component';

/**
 * A grouped list, one row per service problem with a severity rail down its left edge. Notes
 * (elevators, stop moves) fold under a single row at the bottom.
 */
@Component({
  selector: 'app-alert-card',
  templateUrl: './card.component.html',
  styleUrls: ['./alert-styles-shared.css', './card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, AlertDetailComponent]
})
export class CardComponent extends AlertStyleBase {}
