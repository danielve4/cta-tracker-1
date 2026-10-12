export interface Favorite {
  route: string,
  stopId: number,
  stopName: string,
  direction: string,
  type?: 'bus' | 'train',
  /** Train only: the mapid of the station picked for the destination ETA. */
  destStationId?: string
}
