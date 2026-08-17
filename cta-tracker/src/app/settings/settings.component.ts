import { Component, inject, injectAsync, onIdle, ChangeDetectionStrategy, signal } from '@angular/core';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { ToggleSwitchComponent } from '../toggle-switch/toggle-switch.component';
import { ThemeService } from '../services/theme.service';
import { DisplayPreferencesService, SHOW_API_TIMESTAMP_KEY, SHOW_DISTANCE_KEY } from '../services/display-preferences.service';
import type { FavoritesService } from '../services/favorites.service';
import type { Favorite } from '../services/Favorite';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';

/** Keys that survive "Clear Cache" — user preferences and data, not cached API payloads. */
const PRESERVED_KEYS = ['favorites', 'theme-preference', SHOW_API_TIMESTAMP_KEY, SHOW_DISTANCE_KEY];

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeToggleComponent, ToggleSwitchComponent]
})
export class SettingsComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(DisplayPreferencesService);
  private readonly loadFavoritesService = injectAsync(
    () => import('../services/favorites.service').then(m => m.FavoritesService),
    { prefetch: onIdle }
  );

  syncStatus = signal('');
  cacheCleared = signal(false);

  readonly appVersion = '1.0.0';

  async saveFavorites(phone: string): Promise<void> {
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      this.syncStatus.set('Enter a valid 10-digit phone number');
      return;
    }
    this.syncStatus.set('Saving...');
    let favoritesService: FavoritesService;
    try {
      favoritesService = await this.loadFavoritesService();
    } catch {
      this.syncStatus.set('Error: could not load favorites');
      return;
    }
    favoritesService.getFavorites().subscribe((favorites: Array<Favorite>) => {
      favoritesService.saveFavorites(phone.trim(), favorites).subscribe({
        next: (response: HttpResponse<string>) => {
          this.syncStatus.set(response.status === 202 ? 'Favorites saved' : 'Error saving favorites');
        },
        error: (error: HttpErrorResponse) => {
          this.syncStatus.set('Error: ' + (error.error || 'Could not save'));
        }
      });
    });
  }

  async syncFavorites(phone: string): Promise<void> {
    if (!/^[0-9]{10}$/.test(phone.trim())) {
      this.syncStatus.set('Enter a valid 10-digit phone number');
      return;
    }
    this.syncStatus.set('Syncing...');
    let favoritesService: FavoritesService;
    try {
      favoritesService = await this.loadFavoritesService();
    } catch {
      this.syncStatus.set('Error: could not load favorites');
      return;
    }
    favoritesService.syncFavorites(phone.trim()).subscribe({
      next: (response: HttpResponse<string>) => {
        this.syncStatus.set(response.status === 200 ? 'Favorites synced' : 'Error syncing favorites');
      },
      error: (error: HttpErrorResponse) => {
        this.syncStatus.set('Error: ' + (error.error || 'Could not sync'));
      }
    });
  }

  clearCache(): void {
    const preserved = PRESERVED_KEYS.map(key => [key, localStorage.getItem(key)] as const);
    localStorage.clear();
    for (const [key, value] of preserved) {
      if (value !== null) {
        localStorage.setItem(key, value);
      }
    }
    this.cacheCleared.set(true);
    setTimeout(() => this.cacheCleared.set(false), 3000);
  }
}
