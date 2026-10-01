import {
  Component, ChangeDetectionStrategy, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertStyleBase } from './alert-style.base';
import { AlertGlyphComponent } from './alert-glyph.component';
import { AlertDetailComponent } from './alert-detail.component';
import { TOAST_DISMISSED_KEY, toastKey } from '../../services/alerts/alert-styles';

const DOCK_AFTER_MS = 6000;
const DOCK_AFTER_SCROLL_PX = 40;

type Phase = 'hidden' | 'toast' | 'docked';

/**
 * A frosted notification that drops in from the top, then tucks itself into a small chip in the
 * corner after six seconds or as soon as the page scrolls. The chip brings it back. Closing it
 * docks it for the rest of the session, until the set of alerts changes.
 */
@Component({
  selector: 'app-alert-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./alert-styles-shared.css', './toast.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AlertGlyphComponent, AlertDetailComponent]
})
export class ToastComponent extends AlertStyleBase {
  readonly phase = signal<Phase>('hidden');
  private readonly key = computed(() => toastKey(this.alerts()));
  private readonly ready = signal(false);
  private dockTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.ready.set(true);
      const onScroll = () => {
        if (this.phase() === 'toast' && !this.expanded() && window.scrollY > DOCK_AFTER_SCROLL_PX) {
          this.dock();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        clearTimeout(this.dockTimer);
      });
    });

    // A new set of alerts drops the toast in again; one already dismissed this session starts docked.
    effect(() => {
      const key = this.key();
      if (!this.ready() || !key) {
        return;
      }
      untracked(() => {
        if (readDismissed() === key) {
          this.phase.set('docked');
        } else {
          this.show(false);
        }
      });
    });
  }

  show(expanded: boolean): void {
    this.phase.set('toast');
    this.expanded.set(expanded);
    this.scheduleDock();
  }

  dock(): void {
    clearTimeout(this.dockTimer);
    this.expanded.set(false);
    this.phase.set('docked');
  }

  close(): void {
    writeDismissed(this.key());
    this.dock();
  }

  override toggle(): void {
    super.toggle();
    this.scheduleDock();
  }

  protected override onEscape(): void {
    if (this.phase() === 'toast') {
      this.dock();
    }
  }

  /** Only a collapsed toast docks on its own; an expanded one is being read. */
  private scheduleDock(): void {
    clearTimeout(this.dockTimer);
    if (!this.expanded()) {
      this.dockTimer = setTimeout(() => this.dock(), DOCK_AFTER_MS);
    }
  }
}

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(TOAST_DISMISSED_KEY);
  } catch {
    return null;
  }
}

function writeDismissed(key: string): void {
  try {
    sessionStorage.setItem(TOAST_DISMISSED_KEY, key);
  } catch {
    // Blocked storage only means the toast drops in again next visit.
  }
}
