import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe, SlicePipe } from '@angular/common';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { Observable } from 'rxjs';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css'],
  imports: [RouterLink, AsyncPipe, SlicePipe]
})
export class FavoritesComponent implements OnInit {
  favorites$: Observable<Array<Favorite>> | undefined;
  openFavoriteSettings = false;

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
}
