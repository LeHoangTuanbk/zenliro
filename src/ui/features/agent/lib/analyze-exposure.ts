/** Zone system (Ansel Adams) exposure analysis */

import { getLuminance } from './pixel-helpers';

const ZONE_NAMES = [
  'Zone 0 – Pure black',
  'Zone I – Near black',
  'Zone II – Deep shadows',
  'Zone III – Dark shadows with detail',
  'Zone IV – Dark midtones',
  'Zone V – Middle gray (18%)',
  'Zone VI – Light midtones (skin)',
  'Zone VII – Light tones',
  'Zone VIII – Near white with texture',
  'Zone IX – Near white',
  'Zone X – Pure white',
];

const ZONE_BOUNDARIES = [3, 26, 52, 77, 103, 128, 154, 179, 205, 230, 256];

export function analyzeExposure(data: Uint8ClampedArray, w: number, h: number) {
  const zones = new Array(11).fill(0);
  let lumSum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor((w * h) / 30000));

  for (let i = 0; i < w * h; i += step) {
    const idx = i * 4;
    const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
    lumSum += lum;
    count++;

    for (let z = 0; z < 11; z++) {
      if (lum < ZONE_BOUNDARIES[z]) {
        zones[z]++;
        break;
      }
    }
  }

  const meanLuminance = Math.round(lumSum / count);
  const zoneDistribution = zones.map((c, i) => ({
    zone: i,
    name: ZONE_NAMES[i],
    percentage: Math.round((c / count) * 100),
  }));

  const highZones = zones[7] + zones[8] + zones[9] + zones[10];
  const lowZones = zones[0] + zones[1] + zones[2] + zones[3];
  const highPct = (highZones / count) * 100;
  const lowPct = (lowZones / count) * 100;

  let exposureKey: string;
  if (highPct > 40) exposureKey = 'high-key';
  else if (lowPct > 40) exposureKey = 'low-key';
  else exposureKey = 'normal';

  const zonesUsed = zones.filter((c) => (c / count) * 100 > 2).length;
  const utilization =
    zonesUsed >= 9 ? 'excellent' : zonesUsed >= 7 ? 'good' : zonesUsed >= 5 ? 'moderate' : 'narrow';

  const suggestions: string[] = [];
  if (zoneDistribution[0].percentage + zoneDistribution[1].percentage > 10)
    suggestions.push('Shadow detail lost in zones 0-I. Consider raising shadows/blacks.');
  if (zoneDistribution[9].percentage + zoneDistribution[10].percentage > 10)
    suggestions.push('Highlight clipping in zones IX-X. Consider pulling highlights/whites.');
  if (zonesUsed < 5)
    suggestions.push('Narrow dynamic range. Consider increasing contrast or adjusting exposure.');
  if (meanLuminance < 80) suggestions.push('Image is dark overall. Consider increasing exposure.');
  if (meanLuminance > 180)
    suggestions.push('Image is bright overall. Consider decreasing exposure.');
  if (suggestions.length === 0) suggestions.push('Exposure looks well-balanced.');

  return {
    exposureKey,
    dynamicRange: { zonesUsed, utilization },
    zoneDistribution,
    meanLuminance,
    suggestions,
  };
}
