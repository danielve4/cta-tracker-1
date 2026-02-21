// Comprehensive Data types
export interface CTALine {
  route_id: string;
  name: string;
  color: string;
  text_color: string;
}

export interface CTAStation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface CTAStopSequence {
  line: string;
  stops: string[];
}

export interface CTAComprehensiveData {
  lines: CTALine[];
  stations: Record<string, CTAStation>;
  stopSequences: Record<string, CTAStopSequence>;
  lastUpdated: string;
}

// Train Arrivals/Follow types
export interface TrainEta {
  staId: string;
  stpId: string;
  staNm: string;
  stpDe: string;
  rn: string;
  rt: string;
  destSt: string;
  destNm: string;
  trDr: string;
  prdt: string;
  arrT: string;
  isApp: string;
  isSch: string;
  isDly: string;
  isFlt: string;
  flags: string | null;
  lat?: string;
  lon?: string;
  heading?: string;
}

export interface TrainPosition {
  lat: string;
  lon: string;
  heading: string;
}

export interface TrainCtatt {
  tmst: string;
  errCd: string;
  errNm: string | null;
  eta?: TrainEta[];
  position?: TrainPosition;
}

export interface TrainApiResponse {
  ctatt: TrainCtatt;
}

// Utility constants
export const TRAIN_LINE_CSS_MAP: Record<string, string> = {
  'Red': '--cta-red',
  'Blue': '--cta-blue',
  'Brn': '--cta-brown',
  'G': '--cta-green',
  'Org': '--cta-orange',
  'P': '--cta-purple',
  'Pink': '--cta-pink',
  'Y': '--cta-yellow'
};

export const TRAIN_ROUTE_ID_TO_LINE_NAME: Record<string, string> = {
  'Red': 'Red Line',
  'Blue': 'Blue Line',
  'Brn': 'Brown Line',
  'G': 'Green Line',
  'Org': 'Orange Line',
  'P': 'Purple Line',
  'Pink': 'Pink Line',
  'Y': 'Yellow Line'
};

export const TRAIN_DIRECTION_MAP: Record<string, Record<string, string>> = {
  'Red': { '1': 'Howard-bound', '5': '95th/Dan Ryan-bound' },
  'Blue': { '1': "O'Hare-bound", '5': 'Forest Park-bound' },
  'Brn': { '1': 'Kimball-bound', '5': 'Loop-bound' },
  'G': { '1': 'Harlem/Lake-bound', '5': 'Ashland/63rd & Cottage Grove-bound' },
  'Org': { '1': 'Loop-bound', '5': 'Midway-bound' },
  'P': { '1': 'Linden-bound', '5': 'Howard & Loop-bound' },
  'Pink': { '1': 'Loop-bound', '5': '54th/Cermak-bound' },
  'Y': { '1': 'Skokie-bound', '5': 'Howard-bound' }
};
