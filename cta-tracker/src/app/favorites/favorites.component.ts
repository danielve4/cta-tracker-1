import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe, SlicePipe } from '@angular/common';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { Observable } from 'rxjs';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { TRAIN_LINE_CSS_MAP } from '../trainResponse';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css'],
  imports: [RouterLink, AsyncPipe, SlicePipe, ThemeToggleComponent]
})
export class FavoritesComponent implements OnInit {
  favorites$: Observable<Array<Favorite>> | undefined;
  openFavoriteSettings = false;
  editing = false;
  editableFavorites: Favorite[] = [];

  constructor(private favoritesService: FavoritesService) {}

  ngOnInit(): void {
    this.favorites$ = this.favoritesService.getFavorites();
  }

  saveFavorites(phone: string): void {
    if (/^[0-9]{10}$/.test(phone.trim())) {
      this.favoritesService.getFavorites().subscribe((favorites: Array<Favorite>) => {
        this.favoritesService.saveFavorites(phone.trim(), favorites).subscribe({
          next: (response: HttpResponse<string>) => {
            if (response.status === 202) {
              console.log('Saved Favorites');
            } else {
              console.log('Error Saving Favorites');
            }
          },
          error: (error: HttpErrorResponse) => {
            console.log(error.error);
          }
        });
      });
    }
  }

  syncFavorites(phone: string): void {
    if (/^[0-9]{10}$/.test(phone.trim())) {
      this.favoritesService.syncFavorites(phone.trim()).subscribe({
        next: (response: HttpResponse<string>) => {
          if (response.status === 200) {
            console.log('Synced Favorites');
            this.favorites$ = this.favoritesService.getFavorites();
          } else {
            console.log('Error Syncing Favorites');
          }
        },
        error: (error: HttpErrorResponse) => {
          console.log(error.error);
        }
      });
    }
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
