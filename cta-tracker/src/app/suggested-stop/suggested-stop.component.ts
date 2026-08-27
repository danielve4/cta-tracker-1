import { Component, ChangeDetectionStrategy, afterNextRender, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PredictorService, Suggestion } from '../services/prediction/predictor.service';
import { stopViewUrl } from '../services/prediction/stop-key';

/**
 * The suggestion chip on the home screen: "back after a while — heading to your usual stop?"
 *
 * Renders nothing at all unless the predictor produced a confident ranking, which means nothing on
 * the server (this route is prerendered), nothing on a warm relaunch, and nothing until the log has
 * enough history to be worth trusting. An empty suggestions signal is the normal case.
 */
@Component({
  selector: 'app-suggested-stop',
  templateUrl: './suggested-stop.component.html',
  styleUrls: ['./suggested-stop.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuggestedStopComponent {
  private readonly predictor = inject(PredictorService);
  private readonly router = inject(Router);

  protected readonly suggestions = this.predictor.suggestions;

  constructor() {
    // Matches RoutesComponent and FavoritesComponent: nothing that reads local state may run before
    // hydration, or the prerendered shell and the client's first render disagree.
    afterNextRender(() => {
      void this.predictor.predictForColdStart();
    });
  }

  protected open(suggestion: Suggestion): void {
    // Tagged so the resulting stop view is excludable from training. Without this the model would
    // be learning from views it caused itself, and every retrain would confirm its own habits.
    void this.router.navigateByUrl(stopViewUrl(suggestion.event), { state: { entry: 'suggestion' } });
  }

  protected dismiss(): void {
    void this.predictor.dismiss();
  }

  protected label(suggestion: Suggestion): string {
    const { route, direction, kind } = suggestion.event;
    return kind === 'train' ? `${route} Line` : `#${route}${direction ? ' · ' + direction : ''}`;
  }
}
