import { Component, OnInit } from '@angular/core';
import { FavoritesService } from '../services/favorites.service';
import { Favorite } from '../services/Favorite';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.component.html',
  styleUrls: ['./favorites.component.css']
})
export class FavoritesComponent implements OnInit {

  favorites$: Observable<Array<Favorite>>;

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

}
