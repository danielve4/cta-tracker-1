import { Component, ChangeDetectionStrategy, signal, inject, DestroyRef, afterNextRender } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { TRAIN_LINE_CSS_MAP } from '../trainResponse';
import { SuggestedStopComponent } from '../suggested-stop/suggested-stop.component';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SlicePipe, SuggestedStopComponent]
})
export class FavoritesComponent {
  private readonly favoritesService = inject(FavoritesService);
  private readonly destroyRef = inject(DestroyRef);

  favorites = signal<Favorite[] | null>(null);
  editing = signal(false);
  editableFavorites = signal<Favorite[]>([]);

  constructor() {
    // Load after the first (hydration) render: getFavorites() emits cached favorites
    // synchronously via of(...), so deferring keeps the server render and client first
    // render identical.
    afterNextRender(() => this.loadFavorites());
  }

  private loadFavorites(): void {
    this.favoritesService.getFavorites()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((favorites: Array<Favorite>) => this.favorites.set(favorites));
  }

  toggleEdit(): void {
    if (!this.editing()) {
      this.favoritesService.getFavorites()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((favorites: Array<Favorite>) => this.editableFavorites.set([...favorites]));
      this.editing.set(true);
    } else {
      this.favoritesService.reorderFavorites(this.editableFavorites());
      this.loadFavorites();
      this.editing.set(false);
    }
  }

  deleteFavorite(index: number): void {
    const next = this.editableFavorites().filter((_, i) => i !== index);
    this.editableFavorites.set(next);
    this.favoritesService.reorderFavorites(next);
  }

  getTrainLineColor(route: string): string {
    const cssVar = TRAIN_LINE_CSS_MAP[route];
    return cssVar ? `var(${cssVar})` : 'var(--text-tertiary)';
  }

  moveFavorite(index: number, direction: number): void {
    const newIndex = index + direction;
    const current = this.editableFavorites();
    if (newIndex < 0 || newIndex >= current.length) return;
    const next = [...current];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    this.editableFavorites.set(next);
    this.favoritesService.reorderFavorites(next);
  }
}
