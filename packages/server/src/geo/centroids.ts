// US state centroids (approximate geographic center)
// Source: US Census Bureau geographic centers
export const US_STATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.75, lng: -86.75 }, AK: { lat: 64.20, lng: -153.39 },
  AZ: { lat: 34.30, lng: -111.09 }, AR: { lat: 34.75, lng: -92.13 },
  CA: { lat: 37.25, lng: -119.75 }, CO: { lat: 38.50, lng: -105.50 },
  CT: { lat: 41.63, lng: -72.73 }, DE: { lat: 39.00, lng: -75.50 },
  FL: { lat: 28.11, lng: -81.64 }, GA: { lat: 32.70, lng: -83.50 },
  HI: { lat: 20.25, lng: -156.33 }, ID: { lat: 43.57, lng: -114.27 },
  IL: { lat: 40.00, lng: -89.00 }, IN: { lat: 39.77, lng: -86.13 },
  IA: { lat: 41.92, lng: -93.28 }, KS: { lat: 38.50, lng: -98.00 },
  KY: { lat: 37.50, lng: -85.00 }, LA: { lat: 31.23, lng: -91.83 },
  ME: { lat: 45.37, lng: -69.22 }, MD: { lat: 39.07, lng: -76.80 },
  MA: { lat: 42.25, lng: -71.83 }, MI: { lat: 43.33, lng: -84.54 },
  MN: { lat: 46.39, lng: -94.63 }, MS: { lat: 32.68, lng: -89.79 },
  MO: { lat: 38.35, lng: -92.46 }, MT: { lat: 46.88, lng: -110.36 },
  NE: { lat: 41.50, lng: -99.75 }, NV: { lat: 39.16, lng: -117.06 },
  NH: { lat: 43.68, lng: -71.58 }, NJ: { lat: 40.14, lng: -74.73 },
  NM: { lat: 34.52, lng: -106.03 }, NY: { lat: 42.78, lng: -76.00 },
  NC: { lat: 35.50, lng: -79.00 }, ND: { lat: 47.25, lng: -100.25 },
  OH: { lat: 40.25, lng: -82.69 }, OK: { lat: 35.58, lng: -96.92 },
  OR: { lat: 43.80, lng: -120.55 }, PA: { lat: 40.87, lng: -77.83 },
  RI: { lat: 41.68, lng: -71.57 }, SC: { lat: 33.92, lng: -80.90 },
  SD: { lat: 44.34, lng: -100.35 }, TN: { lat: 35.75, lng: -86.25 },
  TX: { lat: 31.83, lng: -99.25 }, UT: { lat: 39.32, lng: -111.09 },
  VT: { lat: 44.07, lng: -72.67 }, VA: { lat: 37.68, lng: -78.17 },
  WA: { lat: 47.42, lng: -120.25 }, WV: { lat: 38.50, lng: -80.67 },
  WI: { lat: 44.50, lng: -90.00 }, WY: { lat: 43.02, lng: -107.55 },
  DC: { lat: 38.91, lng: -77.04 },
};

// Canadian province centroids
export const CA_PROVINCE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  AB: { lat: 53.93, lng: -116.58 }, BC: { lat: 53.73, lng: -127.65 },
  MB: { lat: 53.76, lng: -98.81 },  NB: { lat: 46.50, lng: -66.75 },
  NL: { lat: 53.13, lng: -59.00 },  NS: { lat: 45.00, lng: -63.00 },
  NT: { lat: 64.82, lng: -124.85 }, NU: { lat: 70.30, lng: -83.11 },
  ON: { lat: 50.00, lng: -86.00 },  PE: { lat: 46.25, lng: -63.13 },
  QC: { lat: 53.00, lng: -71.00 },  SK: { lat: 54.00, lng: -106.00 },
  YT: { lat: 63.00, lng: -135.00 },
};

// Country centroids for international participants
export const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  USA: { lat: 39.50, lng: -98.35 }, CAN: { lat: 56.13, lng: -106.35 },
  GBR: { lat: 55.38, lng: -3.44 },  AUS: { lat: -25.27, lng: 133.78 },
  DEU: { lat: 51.17, lng: 10.45 },  FRA: { lat: 46.23, lng: 2.21 },
  JPN: { lat: 36.20, lng: 138.25 }, NZL: { lat: -40.90, lng: 174.89 },
  CHE: { lat: 46.82, lng: 8.23 },   NOR: { lat: 60.47, lng: 8.47 },
  SWE: { lat: 60.13, lng: 18.64 },  FIN: { lat: 64.00, lng: 26.00 },
  DNK: { lat: 56.26, lng: 9.50 },   NLD: { lat: 52.13, lng: 5.29 },
  BEL: { lat: 50.50, lng: 4.47 },   AUT: { lat: 47.52, lng: 14.55 },
  ITA: { lat: 42.83, lng: 12.83 },  ESP: { lat: 40.00, lng: -4.00 },
  PRT: { lat: 39.40, lng: -8.22 },  IRL: { lat: 53.00, lng: -8.00 },
  ZAF: { lat: -28.48, lng: 24.68 }, BRA: { lat: -14.24, lng: -51.93 },
  MEX: { lat: 23.63, lng: -102.55 },CHN: { lat: 35.86, lng: 104.20 },
  KOR: { lat: 35.91, lng: 127.77 }, IND: { lat: 20.59, lng: 78.96 },
};
