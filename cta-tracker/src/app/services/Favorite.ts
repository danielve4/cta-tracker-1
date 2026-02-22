export interface Favorite {
  route: string,
  stopId: number,
  stopName: string,
  direction: string,
  type?: 'bus' | 'train'
}
