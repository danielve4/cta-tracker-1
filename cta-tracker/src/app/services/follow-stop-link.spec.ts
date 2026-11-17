import { describe, expect, it } from 'vitest';
import { busStopCommands, trainRouteCode, trainStationCommands } from './follow-stop-link';

describe('trainRouteCode', () => {
  it('maps the full line names the follow endpoint returns to route codes', () => {
    expect(['Red Line', 'Blue Line', 'Brown Line', 'Green Line', 'Orange Line', 'Purple Line', 'Pink Line', 'Yellow Line']
      .map(trainRouteCode)).toEqual(['Red', 'Blue', 'Brn', 'G', 'Org', 'P', 'Pink', 'Y']);
  });

  it('passes route codes through, whatever their case', () => {
    expect(['Red', 'Brn', 'G', 'Org', 'P', 'Pink', 'Y', 'blue'].map(trainRouteCode))
      .toEqual(['Red', 'Brn', 'G', 'Org', 'P', 'Pink', 'Y', 'Blue']);
  });

  it('reads an express variant as its line', () => {
    expect(trainRouteCode('Purple Line Express')).toBe('P');
  });

  it('returns nothing for a line it does not know', () => {
    expect(trainRouteCode('Silver Line')).toBe('');
    expect(trainRouteCode('')).toBe('');
    expect(trainRouteCode(null)).toBe('');
  });
});

describe('busStopCommands', () => {
  it('builds the arrivals route from the prediction', () => {
    expect(busStopCommands({ rt: '49', rtdir: 'Northbound', stpid: '8212', stpnm: 'Western & Armitage' }))
      .toEqual(['/arrivals', '49', 'Northbound', '8212', 'Western & Armitage']);
  });

  it('keeps a slash in the stop name from splitting the path', () => {
    expect(busStopCommands({ rt: '49', rtdir: 'Northbound', stpid: '1', stpnm: 'Western/Milwaukee' })?.[4])
      .toBe('Western-Milwaukee');
  });

  it('gives no link when a piece of the route is missing', () => {
    expect(busStopCommands({ rt: '49', rtdir: '', stpid: '8212', stpnm: 'Western & Armitage' })).toBeNull();
  });
});

describe('trainStationCommands', () => {
  const eta = { rt: 'Blue Line', staId: '40570', staNm: 'California' };

  it('prefers the route code the follow screen was opened with', () => {
    expect(trainStationCommands({ ...eta, rt: 'Something Else' }, 'Blue'))
      .toEqual(['/train-arrivals', 'Blue', '40570', 'California']);
  });

  it('falls back to the line the prediction names', () => {
    expect(trainStationCommands(eta, '')).toEqual(['/train-arrivals', 'Blue', '40570', 'California']);
  });

  it('gives no link when the line cannot be worked out', () => {
    expect(trainStationCommands({ ...eta, rt: '' }, '')).toBeNull();
  });

  it('keeps a slash in the station name from splitting the path', () => {
    expect(trainStationCommands({ ...eta, staNm: 'Harold Washington Library-State/Van Buren' }, 'Brn')?.[3])
      .toBe('Harold Washington Library-State-Van Buren');
  });
});
