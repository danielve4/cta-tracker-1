import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { TrainService } from '../services/train.service';
import { TrainApiResponse, TrainEta, TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { of, Observable, timer, Subscription } from 'rxjs';
import { TimeuntilPipe } from '../timeuntil.pipe';

interface TrainStopDisplay extends TrainEta {
  countdown: string;
}

@Component({
  selector: 'app-train-follow',
  templateUrl: './train-follow.component.html',
  styleUrls: ['./train-follow.component.css'],
  imports: [AsyncPipe, TimeuntilPipe]
})
export class TrainFollowComponent implements OnInit, OnDestroy {
  runNumber = '';
  fromStationId = '';
  routeCode = '';
  routeName = '';
  destination = '';
  predictions$: Observable<TrainStopDisplay[]> | undefined;
  errorMsg: string | undefined;
  refreshInterval = 30 * 1000;
  timerRef: Subscription | undefined;
  canRefresh = false;
  refreshing = false;
  lineColor = '';

  constructor(
    private activatedRoute: ActivatedRoute,
    private trainService: TrainService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(qp => {
      this.fromStationId = qp['from'] || '';
      this.routeCode = qp['rt'] || '';

      const cssVar = TRAIN_LINE_CSS_MAP[this.routeCode];
      if (cssVar) {
        this.lineColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
      }
    });
    this.activatedRoute.params.subscribe(params => {
      this.canRefresh = true;
      this.runNumber = params['runNumber'];
      this.timerRef = timer(0, this.refreshInterval).subscribe(() => {
        this.getFollowData();
      });
    });
  }

  ngOnDestroy(): void {
    this.timerRef?.unsubscribe();
  }

  getFollowData(): void {
    if (!this.refreshing) {
      this.trainService.follow(this.runNumber).subscribe((response: TrainApiResponse) => {
        this.handleResponse(response);
      });
    }
  }

  handleResponse(response: TrainApiResponse): void {
    this.refreshing = true;

    if (response.ctatt.errCd !== '0' && response.ctatt.errNm) {
      this.errorMsg = response.ctatt.errNm;
      this.predictions$ = undefined;
    } else if (response.ctatt.eta && response.ctatt.eta.length > 0) {
      const etas = response.ctatt.eta;
      if (etas.length > 0) {
        this.routeName = etas[0].rt;
        this.destination = etas[0].destNm;

        if (!this.lineColor) {
          const cssVar = TRAIN_LINE_CSS_MAP[etas[0].rt];
          if (cssVar) {
            this.lineColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
          }
        }
      }

      const displays: TrainStopDisplay[] = etas.map(eta => {
        const countdown = eta.isApp === '1'
          ? 'DUE'
          : this.computeCountdown(eta.prdt, eta.arrT);
        return { ...eta, countdown };
      });

      this.predictions$ = of(displays);
      this.errorMsg = undefined;
    } else {
      this.errorMsg = 'No predictions found';
      this.predictions$ = undefined;
    }

    setTimeout(() => this.refreshing = false, 500);
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
