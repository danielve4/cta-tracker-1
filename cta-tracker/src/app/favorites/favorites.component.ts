import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe, SlicePipe } from '@angular/common';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { Observable } from 'rxjs';
import { TRAIN_LINE_CSS_MAP } from '../trainResponse';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, AsyncPipe, SlicePipe]
})
export class FavoritesComponent implements OnInit {
  favorites$: Observable<Array<Favorite>> | undefined;
  editing = false;
  editableFavorites: Favorite[] = [];

  constructor(private favoritesService: FavoritesService) {}

  ngOnInit(): void {
    this.favorites$ = this.favoritesService.getFavorites();
  }

  toggleEdit(): void {
    if (!this.editing) {
      this.favoritesService.getFavorites().subscribe((favorites: Array<Favorite>) => {
        this.editableFavorites = [...favorites];
      });
      this.editing = true;
    } else {
      this.favoritesService.reorderFavorites(this.editableFavorites);
      this.favorites$ = this.favoritesService.getFavorites();
      this.editing = false;
    }
  }

  deleteFavorite(index: number): void {
    this.editableFavorites.splice(index, 1);
    this.favoritesService.reorderFavorites(this.editableFavorites);
  }

  getTrainLineColor(route: string): string {
    const cssVar = TRAIN_LINE_CSS_MAP[route];
    return cssVar ? `var(${cssVar})` : 'var(--text-tertiary)';
  }

  moveFavorite(index: number, direction: number): void {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.editableFavorites.length) return;
    const temp = this.editableFavorites[index];
    this.editableFavorites[index] = this.editableFavorites[newIndex];
    this.editableFavorites[newIndex] = temp;
    this.favoritesService.reorderFavorites(this.editableFavorites);
  }
}
