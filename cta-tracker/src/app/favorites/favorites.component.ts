import { Component, OnInit } from '@angular/core';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { Observable } from 'rxjs';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css']
})
export class FavoritesComponent implements OnInit {

  favorites$: Observable<Array<Favorite>>;
  openFavoriteSettings: boolean = false;

  constructor(private favoritesService: FavoritesService) { }

  ngOnInit() {
    const fav: Favorite = {
      route: "72",
      stopId: 881,
      stopName: "North + Lawndale",
      direction: "East Bound"
    };
    console.log(fav);
    // this.favoritesService.removeFromFavorites(fav).subscribe((wasAdded:boolean) => {
    //   console.log(wasAdded);
    // });
    this.favorites$ = this.favoritesService.getFavorites();
    // this.favoritesService.searchFavorite(fav).subscribe(val => {
    //   console.log(val);
    // });
  }

  saveFavorites(phone: string) {
    if (/^[0-9]{10}$/.test(phone.trim())) {
      this.favoritesService.getFavorites().subscribe((favorites: Array<Favorite>) => {
        this.favoritesService.saveFavorites(phone.trim(), favorites).subscribe((response: HttpResponse<string>) => {
          if (response.status === 202)
            console.log('Saved Favorites');
          else
            console.log('Error Saving Favorites');
        }, (error: HttpErrorResponse) => {
          console.log(error.error);
        });
      });
    }
  }

  syncFavorites(phone: string) {
    if (/^[0-9]{10}$/.test(phone.trim())) {
      this.favoritesService.syncFavorites(phone.trim()).subscribe((response: HttpResponse<string>) => {
        if (response.status === 200) {
          console.log('Synced Favorites');
          this.favorites$ = this.favoritesService.getFavorites();
        } else
          console.log('Error Syncing Favorites');
      }, (error: HttpErrorResponse) => {
        console.log(error.error);
      });
    }
  }
}
