import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const source = JSON.parse(
  readFileSync(join(__dirname, 'node_modules/philippines/philippine_provinces_cities_municipalities_and_barangays_2019v2.json'), 'utf8')
);

// Full display names keyed by the source JSON keys
const regionNames = {
  'NCR':  'National Capital Region',
  'CAR':  'Cordillera Administrative Region',
  'BARMM':'Bangsamoro Autonomous Region in Muslim Mindanao',
  '01':   'Ilocos Region (Region I)',
  '02':   'Cagayan Valley (Region II)',
  '03':   'Central Luzon (Region III)',
  '4A':   'CALABARZON (Region IV-A)',
  '4B':   'MIMAROPA (Region IV-B)',
  '05':   'Bicol Region (Region V)',
  '06':   'Western Visayas (Region VI)',
  '07':   'Central Visayas (Region VII)',
  '08':   'Eastern Visayas (Region VIII)',
  '09':   'Zamboanga Peninsula (Region IX)',
  '10':   'Northern Mindanao (Region X)',
  '11':   'Davao Region (Region XI)',
  '12':   'SOCCSKSARGEN (Region XII)',
  '13':   'Caraga (Region XIII)',
};

// Words that should always be lowercase (Spanish/Filipino connectives only)
const lowerWords = new Set(['del', 'de', 'la', 'los', 'ng']);

// Title-case helper
const toTitle = str =>
  str
    .split(' ')
    .map((w, i) => {
      const lower = w.toLowerCase();
      // Keep words with punctuation as-is (e.g. "POB.", "I.", "II.")
      if (/[^a-zA-Z]/.test(w)) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      // Connectives lowercase (unless first word)
      if (i > 0 && lowerWords.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

// Preferred order of regions (NCR first, then by number)
const keyOrder = ['NCR', '01', '02', '03', '4A', '4B', '05', '06', '07', '08', '09', '10', '11', '12', '13', 'CAR', 'BARMM'];

const result = { regions: [] };

for (const code of keyOrder) {
  const regionData = source[code];
  if (!regionData) continue;

  const regionEntry = {
    region: code,
    name: regionNames[code] || regionData.region_name,
    provinces: [],
  };

  for (const [provName, provData] of Object.entries(regionData.province_list || {})) {
    const provinceEntry = {
      name: toTitle(provName),
      cities: [],
    };

    for (const [cityName, cityData] of Object.entries(provData.municipality_list || {})) {
      provinceEntry.cities.push({
        name: toTitle(cityName),
        barangays: (cityData.barangay_list || []).map(toTitle),
      });
    }

    regionEntry.provinces.push(provinceEntry);
  }

  result.regions.push(regionEntry);
}

writeFileSync(
  join(__dirname, 'data/philippine-locations.json'),
  JSON.stringify(result, null, 2)
);

console.log(`Done! ${result.regions.length} regions written to data/philippine-locations.json`);
result.regions.forEach(r => console.log(` ${r.region} | ${r.name} | ${r.provinces.length} provinces`));
