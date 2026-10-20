import type { RegionId } from "./vacancy"

export type Bounds = [west: number, south: number, east: number, north: number]

export const WORLD_REGIONS: ReadonlyArray<{ id: RegionId; label: string; short: string; bounds: Bounds }> = [
  { id: "north-america", label: "North America", short: "N. America", bounds: [-127, 23, -63, 54] },
  { id: "europe", label: "Europe", short: "Europe", bounds: [-11, 35, 31, 62] },
  { id: "asia", label: "Asia", short: "Asia", bounds: [68, -8, 146, 46] },
  { id: "latin-america", label: "Latin America", short: "Latin Am.", bounds: [-112, -50, -34, 30] },
  { id: "africa-middle-east", label: "Africa & Middle East", short: "Africa & ME", bounds: [-18, -35, 62, 42] },
  { id: "oceania", label: "Oceania", short: "Oceania", bounds: [112, -47, 179, -10] },
]

export const WORLD_BOUNDS: Bounds = [-128, -42, 150, 62]

type R = "NA" | "LA" | "EU" | "AM" | "AS" | "OC"
const REGION_CODE: Record<R, RegionId> = {
  NA: "north-america",
  LA: "latin-america",
  EU: "europe",
  AM: "africa-middle-east",
  AS: "asia",
  OC: "oceania",
}

// iso2, display name, region, fallback lat/lng (main academic city / capital), aliases
const COUNTRY_ROWS: Array<[string, string, R, number, number, ...string[]]> = [
  ["US", "United States", "NA", 39.5, -98.35, "UNITED STATES OF AMERICA", "USA", "U.S.A."],
  ["CA", "Canada", "NA", 45.42, -75.69],
  ["MX", "Mexico", "LA", 19.43, -99.13],
  ["GT", "Guatemala", "LA", 14.63, -90.51],
  ["CR", "Costa Rica", "LA", 9.93, -84.08],
  ["PA", "Panama", "LA", 8.98, -79.52],
  ["CO", "Colombia", "LA", 4.71, -74.07],
  ["VE", "Venezuela", "LA", 10.48, -66.9],
  ["EC", "Ecuador", "LA", -0.18, -78.47],
  ["PE", "Peru", "LA", -12.05, -77.04],
  ["BO", "Bolivia", "LA", -16.5, -68.15],
  ["CL", "Chile", "LA", -33.45, -70.67],
  ["AR", "Argentina", "LA", -34.6, -58.38],
  ["UY", "Uruguay", "LA", -34.9, -56.16],
  ["PY", "Paraguay", "LA", -25.26, -57.58],
  ["BR", "Brazil", "LA", -23.55, -46.63],
  ["DO", "Dominican Republic", "LA", 18.49, -69.93],
  ["JM", "Jamaica", "LA", 18.01, -76.8],
  ["BB", "Barbados", "LA", 13.1, -59.62],
  ["PR", "Puerto Rico", "LA", 18.47, -66.11],
  ["GF", "French Guiana", "LA", 4.92, -52.31],
  ["TT", "Trinidad and Tobago", "LA", 10.64, -61.4, "TRINIDAD", "TRINIDAD & TOBAGO"],
  ["BS", "Bahamas", "LA", 25.05, -77.35, "THE BAHAMAS"],
  ["BZ", "Belize", "LA", 17.25, -88.77],
  ["GY", "Guyana", "LA", 6.8, -58.16],
  ["SR", "Suriname", "LA", 5.85, -55.2],
  ["HN", "Honduras", "LA", 14.07, -87.19],
  ["SV", "El Salvador", "LA", 13.69, -89.22],
  ["NI", "Nicaragua", "LA", 12.11, -86.24],
  ["CU", "Cuba", "LA", 23.11, -82.37],
  ["HT", "Haiti", "LA", 18.54, -72.34],
  ["GB", "United Kingdom", "EU", 51.51, -0.13, "UK", "GREAT BRITAIN", "ENGLAND", "SCOTLAND", "WALES", "NORTHERN IRELAND"],
  ["IE", "Ireland", "EU", 53.35, -6.26],
  ["FR", "France", "EU", 48.86, 2.35],
  ["DE", "Germany", "EU", 52.52, 13.4],
  ["NL", "Netherlands", "EU", 52.37, 4.9, "THE NETHERLANDS"],
  ["BE", "Belgium", "EU", 50.85, 4.35],
  ["LU", "Luxembourg", "EU", 49.61, 6.13],
  ["LI", "Liechtenstein", "EU", 47.14, 9.52],
  ["CH", "Switzerland", "EU", 47.37, 8.54],
  ["AT", "Austria", "EU", 48.21, 16.37],
  ["IT", "Italy", "EU", 41.9, 12.5],
  ["ES", "Spain", "EU", 40.42, -3.7],
  ["PT", "Portugal", "EU", 38.72, -9.14],
  ["DK", "Denmark", "EU", 55.68, 12.57],
  ["SE", "Sweden", "EU", 59.33, 18.07],
  ["NO", "Norway", "EU", 59.91, 10.75],
  ["FI", "Finland", "EU", 60.17, 24.94],
  ["IS", "Iceland", "EU", 64.15, -21.94],
  ["PL", "Poland", "EU", 52.23, 21.01],
  ["CZ", "Czechia", "EU", 50.08, 14.44, "CZECH REPUBLIC"],
  ["SK", "Slovakia", "EU", 48.15, 17.11],
  ["HU", "Hungary", "EU", 47.5, 19.04],
  ["SI", "Slovenia", "EU", 46.06, 14.51],
  ["HR", "Croatia", "EU", 45.81, 15.98],
  ["RS", "Serbia", "EU", 44.79, 20.45],
  ["BA", "Bosnia and Herzegovina", "EU", 43.86, 18.41],
  ["ME", "Montenegro", "EU", 42.44, 19.26],
  ["MK", "North Macedonia", "EU", 41.99, 21.43, "MACEDONIA"],
  ["AL", "Albania", "EU", 41.33, 19.82],
  ["XK", "Kosovo", "EU", 42.66, 21.17],
  ["MD", "Moldova", "EU", 47.01, 28.86, "MOLDOVA, REPUBLIC OF"],
  ["RO", "Romania", "EU", 44.43, 26.1],
  ["BG", "Bulgaria", "EU", 42.7, 23.32],
  ["GR", "Greece", "EU", 37.98, 23.73],
  ["CY", "Cyprus", "EU", 35.17, 33.36],
  ["MT", "Malta", "EU", 35.9, 14.51],
  ["EE", "Estonia", "EU", 59.44, 24.75],
  ["LV", "Latvia", "EU", 56.95, 24.11],
  ["LT", "Lithuania", "EU", 54.69, 25.28],
  ["UA", "Ukraine", "EU", 50.45, 30.52],
  ["BY", "Belarus", "EU", 53.9, 27.56],
  ["AD", "Andorra", "EU", 42.51, 1.52],
  ["MC", "Monaco", "EU", 43.74, 7.42],
  ["SM", "San Marino", "EU", 43.94, 12.45],
  ["GE", "Georgia", "AM", 41.72, 44.79],
  ["AM", "Armenia", "AM", 40.18, 44.51],
  ["AZ", "Azerbaijan", "AM", 40.41, 49.87],
  ["RU", "Russia", "EU", 55.76, 37.62, "RUSSIAN FEDERATION"],
  ["TR", "Türkiye", "AM", 41.01, 28.98, "TURKEY", "TURKIYE"],
  ["EG", "Egypt", "AM", 30.04, 31.24],
  ["MA", "Morocco", "AM", 34.02, -6.84],
  ["TN", "Tunisia", "AM", 36.81, 10.18],
  ["DZ", "Algeria", "AM", 36.75, 3.06],
  ["ZA", "South Africa", "AM", -33.92, 18.42],
  ["NG", "Nigeria", "AM", 6.52, 3.38],
  ["GH", "Ghana", "AM", 5.6, -0.19],
  ["KE", "Kenya", "AM", -1.29, 36.82],
  ["ET", "Ethiopia", "AM", 9.03, 38.74],
  ["RW", "Rwanda", "AM", -1.95, 30.06],
  ["UG", "Uganda", "AM", 0.35, 32.58],
  ["TZ", "Tanzania", "AM", -6.79, 39.21],
  ["SN", "Senegal", "AM", 14.72, -17.47],
  ["CI", "Côte d'Ivoire", "AM", 5.36, -4.01, "IVORY COAST", "COTE D IVOIRE"],
  ["CM", "Cameroon", "AM", 3.85, 11.5],
  ["BJ", "Benin", "AM", 6.37, 2.39],
  ["BF", "Burkina Faso", "AM", 12.37, -1.52],
  ["ML", "Mali", "AM", 12.64, -8],
  ["NE", "Niger", "AM", 13.51, 2.11],
  ["TG", "Togo", "AM", 6.13, 1.22],
  ["SL", "Sierra Leone", "AM", 8.48, -13.23],
  ["LR", "Liberia", "AM", 6.3, -10.8],
  ["GM", "Gambia", "AM", 13.45, -16.58, "THE GAMBIA"],
  ["CD", "DR Congo", "AM", -4.32, 15.31, "DEMOCRATIC REPUBLIC OF THE CONGO", "CONGO, DEMOCRATIC REPUBLIC OF THE"],
  ["CG", "Congo", "AM", -4.27, 15.27, "REPUBLIC OF THE CONGO"],
  ["AO", "Angola", "AM", -8.84, 13.23],
  ["ZM", "Zambia", "AM", -15.39, 28.32],
  ["ZW", "Zimbabwe", "AM", -17.83, 31.05],
  ["MW", "Malawi", "AM", -13.96, 33.79],
  ["MZ", "Mozambique", "AM", -25.97, 32.57],
  ["BW", "Botswana", "AM", -24.65, 25.91],
  ["NA", "Namibia", "AM", -22.56, 17.08],
  ["MU", "Mauritius", "AM", -20.16, 57.5],
  ["MG", "Madagascar", "AM", -18.88, 47.51],
  ["SD", "Sudan", "AM", 15.5, 32.56],
  ["SO", "Somalia", "AM", 2.05, 45.32],
  ["LY", "Libya", "AM", 32.89, 13.19],
  ["IL", "Israel", "AM", 32.08, 34.78],
  ["LB", "Lebanon", "AM", 33.89, 35.5],
  ["JO", "Jordan", "AM", 31.95, 35.93],
  ["SA", "Saudi Arabia", "AM", 24.71, 46.68],
  ["AE", "United Arab Emirates", "AM", 24.45, 54.38, "UAE"],
  ["QA", "Qatar", "AM", 25.29, 51.53],
  ["KW", "Kuwait", "AM", 29.38, 47.99],
  ["BH", "Bahrain", "AM", 26.23, 50.59],
  ["OM", "Oman", "AM", 23.59, 58.41],
  ["IQ", "Iraq", "AM", 33.31, 44.36],
  ["SY", "Syria", "AM", 33.51, 36.29],
  ["PS", "Palestine", "AM", 31.9, 35.2, "PALESTINIAN TERRITORY", "STATE OF PALESTINE"],
  ["YE", "Yemen", "AM", 15.37, 44.19],
  ["IR", "Iran", "AM", 35.69, 51.39, "IRAN, ISLAMIC REPUBLIC OF"],
  ["CN", "China", "AS", 39.9, 116.4],
  ["HK", "Hong Kong", "AS", 22.28, 114.16, "HONG KONG SAR", "HONG KONG, CHINA"],
  ["MO", "Macao", "AS", 22.2, 113.55, "MACAU"],
  ["TW", "Taiwan", "AS", 25.03, 121.57, "TAIWAN, PROVINCE OF CHINA"],
  ["JP", "Japan", "AS", 35.68, 139.69],
  ["KR", "South Korea", "AS", 37.57, 126.98, "KOREA, REPUBLIC OF", "KOREA", "REPUBLIC OF KOREA"],
  ["SG", "Singapore", "AS", 1.35, 103.82],
  ["MY", "Malaysia", "AS", 3.14, 101.69],
  ["TH", "Thailand", "AS", 13.76, 100.5],
  ["VN", "Vietnam", "AS", 21.03, 105.85, "VIET NAM"],
  ["ID", "Indonesia", "AS", -6.21, 106.85],
  ["PH", "Philippines", "AS", 14.6, 120.98],
  ["IN", "India", "AS", 28.61, 77.21],
  ["PK", "Pakistan", "AS", 31.55, 74.34],
  ["BD", "Bangladesh", "AS", 23.81, 90.41],
  ["LK", "Sri Lanka", "AS", 6.93, 79.86],
  ["NP", "Nepal", "AS", 27.72, 85.32],
  ["KZ", "Kazakhstan", "AS", 51.17, 71.45],
  ["UZ", "Uzbekistan", "AS", 41.3, 69.24],
  ["MN", "Mongolia", "AS", 47.89, 106.91],
  ["KG", "Kyrgyzstan", "AS", 42.87, 74.59],
  ["TJ", "Tajikistan", "AS", 38.56, 68.77],
  ["AF", "Afghanistan", "AS", 34.53, 69.17],
  ["KH", "Cambodia", "AS", 11.56, 104.92],
  ["LA", "Laos", "AS", 17.97, 102.63, "LAO PEOPLE S DEMOCRATIC REPUBLIC"],
  ["MM", "Myanmar", "AS", 16.87, 96.2, "BURMA"],
  ["BN", "Brunei", "AS", 4.89, 114.94, "BRUNEI DARUSSALAM"],
  ["BT", "Bhutan", "AS", 27.47, 89.64],
  ["MV", "Maldives", "AS", 4.18, 73.51],
  ["AU", "Australia", "OC", -33.87, 151.21],
  ["NZ", "New Zealand", "OC", -36.85, 174.76],
  ["FJ", "Fiji", "OC", -18.14, 178.44],
  ["PG", "Papua New Guinea", "OC", -9.44, 147.18],
  ["WS", "Samoa", "OC", -13.83, -171.76],
  ["TO", "Tonga", "OC", -21.14, -175.2],
]

export type Country = { iso2: string; name: string; region: RegionId; lat: number; lng: number }

const BY_KEY = new Map<string, Country>()
for (const [iso2, name, region, lat, lng, ...aliases] of COUNTRY_ROWS) {
  const country: Country = { iso2, name, region: REGION_CODE[region], lat, lng }
  for (const key of [iso2, name, ...aliases]) BY_KEY.set(countryKey(key), country)
}

function countryKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z,]+/g, " ")
    .trim()
}

export function findCountry(nameOrIso2: string | null | undefined): Country | null {
  if (!nameOrIso2) return null
  return BY_KEY.get(countryKey(nameOrIso2)) ?? null
}

/** Coarse fallback when a country is not in the table */
export function regionForPoint(lat: number, lng: number): RegionId {
  if (lng < -30) return lat > 23 ? "north-america" : "latin-america"
  if (lng > 110 && lat < -8) return "oceania"
  if (lng > 60) return "asia"
  if (lat > 36 && lng < 45) return "europe"
  return "africa-middle-east"
}

/** Whether `outer` holds all of `inner`, give or take `slack` degrees on each side */
export function boundsCover(outer: Bounds, inner: Bounds, slack = 0) {
  return (
    outer[0] <= inner[0] + slack && outer[1] <= inner[1] + slack && outer[2] >= inner[2] - slack && outer[3] >= inner[3] - slack
  )
}

export function boundsContain(b: Bounds, lng: number, lat: number) {
  const [w, s, e, n] = b
  if (lat < s || lat > n) return false
  if (e - w >= 360) return true
  const x = ((((lng - w) % 360) + 360) % 360) + w
  return x <= e
}
