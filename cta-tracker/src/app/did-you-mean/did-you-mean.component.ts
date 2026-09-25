import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PredictorService, Suggestion } from '../services/prediction/predictor.service';
import { stopRouteLabel, stopViewUrl } from '../services/prediction/stop-key';

/**
 * "Did you mean to view arrivals for …?" — raised when the first stop of a cold-start session is
 * out of character for the time of day and a routine points somewhere else.
 *
 * Rendered once, in AppComponent, rather than in the two arrivals screens: the check runs at the
 * router, after the stop view is logged, and knows nothing about which screen is showing. It renders
 * nothing while the signal is null, which is always the case on the server.
 */
@Component({
  selector: 'app-did-you-mean',
  templateUrl: './did-you-mean.component.html',
  styleUrls: ['./did-you-mean.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DidYouMeanComponent {
  private readonly predictor = inject(PredictorService);
  private readonly router = inject(Router);

  protected readonly suggestion = this.predictor.didYouMean;

  protected open(suggestion: Suggestion): void {
    void this.predictor.acceptDidYouMean();
    // Tagged 'suggestion': the stop is the model's pick, so the view must stay out of training.
    void this.router.navigateByUrl(stopViewUrl(suggestion.event), { state: { entry: 'suggestion' } });
  }

  protected dismiss(): void {
    void this.predictor.dismissDidYouMean();
  }

  protected label(suggestion: Suggestion): string {
    return stopRouteLabel(suggestion.event);
  }
}
