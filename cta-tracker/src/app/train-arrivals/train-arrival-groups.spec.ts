import { describe, expect, it } from 'vitest';
import {
  ArrivalGroup, TrainArrivalDisplay, directionSortKey, groupTrainArrivals, mergeTimeline,
  shortDestination, splitNextUp
} from './train-arrival-groups';

/** An arrival with sane defaults, so each test states only the fields it is actually about. */
function eta(overrides: Partial<TrainArrivalDisplay> = {}): TrainArrivalDisplay {
  return {
    staId: '40260',
    stpId: '30073',
    staNm: 'State/Lake',
    stpDe: 'Service toward Harlem',
    rn: '801',
    rt: 'G',
    destSt: '30004',
    destNm: 'Harlem/Lake',
    trDr: '1',
    prdt: '2026-09-15T08:00:00',
    arrT: '2026-09-15T08:04:00',
    isApp: '0',
    isSch: '0',
    isDly: '0',
    isFlt: '0',
    flags: null,
    countdown: '4',
    arrivalEpochMs: Date.UTC(2026, 8, 15, 13, 4, 0),
    apiArrivalTime: '8:04 AM',
    distance: '~0.4 mi',
    lineColor: 'var(--cta-green)',
    ...overrides
  };
}

const labels = (groups: ArrivalGroup[]) => groups.map(group => group.directionLabel);
const keys = (groups: ArrivalGroup[]) => groups.map(group => group.key);

describe('directionSortKey', () => {
  it('orders the two directions CTA actually reports', () => {
    expect(directionSortKey('1')).toBe(1);
    expect(directionSortKey('5')).toBe(5);
  });

  it('sorts anything else last', () => {
    expect(directionSortKey('')).toBe(Number.MAX_SAFE_INTEGER);
    expect(directionSortKey('3')).toBe(Number.MAX_SAFE_INTEGER);
    expect(directionSortKey('N')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('groupTrainArrivals', () => {
  it('groups by route and direction', () => {
    const groups = groupTrainArrivals([
      eta({ rt: 'G', trDr: '1', rn: '801' }),
      eta({ rt: 'G', trDr: '5', rn: '802' }),
      eta({ rt: 'G', trDr: '1', rn: '803' }),
      eta({ rt: 'Pink', trDr: '1', rn: '311' })
    ], 'direction');

    expect(keys(groups).sort()).toEqual(['G_1', 'G_5', 'Pink_1']);
    expect(groups.find(group => group.key === 'G_1')!.arrivals).toHaveLength(2);
  });

  it('labels each group from the direction map', () => {
    const groups = groupTrainArrivals([
      eta({ rt: 'Red', trDr: '1' }),
      eta({ rt: 'Red', trDr: '5' })
    ], 'direction');

    expect(labels(groups)).toEqual(['Howard-bound', '95th/Dan Ryan-bound']);
  });

  it('falls back to the API stop description for a route the map does not know', () => {
    const groups = groupTrainArrivals(
      [eta({ rt: 'Purple Express', trDr: '1', stpDe: 'Service toward Linden' })],
      'direction'
    );

    expect(labels(groups)).toEqual(['Service toward Linden']);
  });

  it("puts trDr 1 before trDr 5 under 'direction', whatever the labels sort like", () => {
    // Red's trDr 5 label ('95th/Dan Ryan-bound') sorts before its trDr 1 label alphabetically,
    // which is exactly the flip the column layout cannot have.
    const groups = groupTrainArrivals([
      eta({ rt: 'Red', trDr: '5' }),
      eta({ rt: 'Red', trDr: '1' })
    ], 'direction');

    expect(groups.map(group => group.trDr)).toEqual(['1', '5']);
  });

  it("sorts an unknown direction last under 'direction'", () => {
    const groups = groupTrainArrivals([
      eta({ rt: 'G', trDr: '', stpDe: 'A yard move' }),
      eta({ rt: 'G', trDr: '5' }),
      eta({ rt: 'G', trDr: '1' })
    ], 'direction');

    expect(groups.map(group => group.trDr)).toEqual(['1', '5', '']);
  });

  it("keeps the alphabetical order the list layout already has under 'label'", () => {
    const groups = groupTrainArrivals([
      eta({ rt: 'Red', trDr: '1' }),
      eta({ rt: 'Red', trDr: '5' })
    ], 'label');

    expect(labels(groups)).toEqual(['95th/Dan Ryan-bound', 'Howard-bound']);
  });

  it('keeps the API order of arrivals within a group', () => {
    const groups = groupTrainArrivals([
      eta({ trDr: '1', rn: '801', countdown: 'DUE' }),
      eta({ trDr: '1', rn: '802', countdown: '6' }),
      eta({ trDr: '1', rn: '803', countdown: '14' })
    ], 'direction');

    expect(groups[0].arrivals.map(arrival => arrival.rn)).toEqual(['801', '802', '803']);
  });

  it('keeps both Green Line trDr 5 branches in one group', () => {
    // 'Ashland/63rd & Cottage Grove-bound' is a single direction that serves two terminals, which
    // is why the column cards keep showing a destination per train.
    const groups = groupTrainArrivals([
      eta({ rt: 'G', trDr: '5', destNm: 'Ashland/63rd' }),
      eta({ rt: 'G', trDr: '5', destNm: 'Cottage Grove' })
    ], 'direction');

    expect(groups).toHaveLength(1);
    expect(groups[0].arrivals.map(arrival => arrival.destNm))
      .toEqual(['Ashland/63rd', 'Cottage Grove']);
  });
});

describe('splitNextUp', () => {
  const group = (arrivals: TrainArrivalDisplay[]): ArrivalGroup =>
    ({ key: 'G_1', trDr: '1', directionLabel: 'Harlem/Lake-bound', arrivals });

  it('separates the next train from the ones behind it', () => {
    const split = splitNextUp(group([
      eta({ rn: '801', countdown: 'DUE' }),
      eta({ rn: '802', countdown: '7' }),
      eta({ rn: '803', countdown: '14' })
    ]));

    expect(split.hero?.rn).toBe('801');
    expect(split.later.map(arrival => arrival.rn)).toEqual(['802', '803']);
  });

  it('gives no later trains for a group of one', () => {
    const split = splitNextUp(group([eta({ rn: '801' })]));
    expect(split.hero?.rn).toBe('801');
    expect(split.later).toEqual([]);
  });
});

describe('mergeTimeline', () => {
  const at = (minutes: number) => Date.UTC(2026, 8, 15, 13, minutes, 0);
  const group = (key: string, trDr: string, arrivals: TrainArrivalDisplay[]): ArrivalGroup =>
    ({ key, trDr, directionLabel: key, arrivals });

  it('interleaves both directions by arrival time and tags the side', () => {
    const rows = mergeTimeline([
      group('G_1', '1', [eta({ rn: '801', arrivalEpochMs: at(1) }), eta({ rn: '802', arrivalEpochMs: at(12) })]),
      group('G_5', '5', [eta({ rn: '803', arrivalEpochMs: at(4) }), eta({ rn: '804', arrivalEpochMs: at(19) })])
    ]);

    expect(rows.map(row => row.arrival.rn)).toEqual(['801', '803', '802', '804']);
    expect(rows.map(row => row.side)).toEqual(['left', 'right', 'left', 'right']);
  });

  it('sorts arrivals with no readable time last, not first', () => {
    const rows = mergeTimeline([
      group('G_1', '1', [eta({ rn: '801', arrivalEpochMs: NaN }), eta({ rn: '802', arrivalEpochMs: at(12) })]),
      group('G_5', '5', [eta({ rn: '803', arrivalEpochMs: at(4) })])
    ]);

    expect(rows.map(row => row.arrival.rn)).toEqual(['803', '802', '801']);
  });

  it('keeps the left direction first when two trains share an instant', () => {
    const rows = mergeTimeline([
      group('G_1', '1', [eta({ rn: '801', arrivalEpochMs: at(5) })]),
      group('G_5', '5', [eta({ rn: '803', arrivalEpochMs: at(5) })])
    ]);

    expect(rows.map(row => row.arrival.rn)).toEqual(['801', '803']);
  });

  it('keeps API order within a direction when instants are equal', () => {
    const rows = mergeTimeline([
      group('G_1', '1', [eta({ rn: '801', arrivalEpochMs: at(5) }), eta({ rn: '802', arrivalEpochMs: at(5) })])
    ]);

    expect(rows.map(row => row.arrival.rn)).toEqual(['801', '802']);
  });

  it('handles a single group and no groups at all', () => {
    expect(mergeTimeline([]).length).toBe(0);
    const rows = mergeTimeline([group('G_5', '5', [eta({ rn: '803', arrivalEpochMs: at(4) })])]);
    expect(rows.map(row => row.side)).toEqual(['left']);
  });
});

describe('shortDestination', () => {
  it('keeps the part before a branch separator', () => {
    expect(shortDestination('Ashland/63rd')).toBe('Ashland');
    expect(shortDestination('Harlem/Lake')).toBe('Harlem');
    expect(shortDestination('95th/Dan Ryan')).toBe('95th');
    expect(shortDestination('Howard & Loop')).toBe('Howard');
  });

  it('leaves a short single-word destination alone', () => {
    expect(shortDestination('Cottage Grove')).toBe('Cottage Grove');
    expect(shortDestination('Midway')).toBe('Midway');
  });

  it('truncates anything still too long for a chip', () => {
    expect(shortDestination('Dempster-Skokie Yard')).toBe('Dempster-Skoki…');
    expect(shortDestination('Dempster-Skokie Yard').length).toBeLessThanOrEqual(15);
  });
});
