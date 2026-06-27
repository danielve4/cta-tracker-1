import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TrainEta, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { timer, Subscription } from 'rxjs';
import { TimeuntilPipe } from '../timeuntil.pipe';

interface TrainStopDisplay extends TrainEta {
  countdown: string;
}

@Component({
  selector: 'app-train-follow',
  templateUrl: './train-follow.component.html',
  styleUrls: ['./train-follow.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimeuntilPipe]
})
export class TrainFollowComponent implements OnInit, OnDestroy {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly trainService = inject(TrainService);
  private readonly destroyRef = inject(DestroyRef);

  runNumber = signal('');
  fromStationId = signal('');
  private routeCode = '';
  routeName = signal('');
  destination = signal('');
  predictions = signal<TrainStopDisplay[] | null>(null);
  errorMsg = signal<string | undefined>(undefined);
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  canRefresh = signal(false);
  refreshing = signal(false);
  lineColor = signal('');

  ngOnInit(): void {
    this.activatedRoute.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(qp => {
      this.fromStationId.set(qp['from'] || '');
      this.routeCode = qp['rt'] || '';

      const cssVar = TRAIN_LINE_CSS_MAP[this.routeCode];
      if (cssVar) {
        this.lineColor.set(getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim());
      }
    });
    this.activatedRoute.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.canRefresh.set(true);
      this.runNumber.set(params['runNumber']);
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        this.getFollowData();
      });
    });
  }

  ngOnDestroy(): void {
    this.timerRef?.unsubscribe();
  }

  getFollowData(): void {
    if (!this.refreshing()) {
      this.trainService.follow(this.runNumber()).subscribe((response: TrainApiResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: TrainApiResponse): void {
    this.refreshing.set(true);

    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      this.errorMsg.set(response.ctatt.errNm);
      this.predictions.set(null);
    } else if (response.ctatt.eta && response.ctatt.eta.length > 0) {
      const etas = response.ctatt.eta;
      if (etas.length > 0) {
        this.routeName.set(etas[0].rt);
        this.destination.set(etas[0].destNm);

        if (!this.lineColor()) {
          const cssVar = TRAIN_LINE_CSS_MAP[etas[0].rt];
          if (cssVar) {
            this.lineColor.set(getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim());
          }
        }
      }

      const displays: TrainStopDisplay[] = etas.map(eta => {
        const countdown = eta.isApp === '1'
          ? 'DUE'
          : this.computeCountdown(eta.prdt, eta.arrT);
        return { ...eta, countdown };
      });

      this.predictions.set(displays);
      this.errorMsg.set(undefined);
    } else {
      this.errorMsg.set('No predictions found');
      this.predictions.set(null);
    }

    setTimeout(() => this.refreshing.set(false), 500);
    if (typeof window.navigator.vibrate !== 'undefined') {
      window.navigator.vibrate(5);
    }
  }

  computeCountdown(prdt: string, arrT: string): string {
    try {
      const predTime = new Date(prdt).getTime();
      const arrTime = new Date(arrT).getTime();
      const minutes = Math.round((arrTime - predTime) / 60000);
      return minutes > 1 ? String(minutes) : 'DUE';
    } catch {
      return '--';
    }
  }
}
