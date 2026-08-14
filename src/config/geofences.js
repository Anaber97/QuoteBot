// src/config/geofences.js
// @ts-check

export const METRO_MULTIPLIER = 1.2857; // +28.57% Metro Traffic Surcharge
export const HAZARD_MULTIPLIER = 1.4;   // +35% Severe Hazard Surcharge (or customize per zone)

export const HAZARD_ZONES = {
  donner_pass: {
    id: 'donner_pass',
    name: 'Donner Pass / I-80 Winter Hazard (CA/NV)',
    multiplier: 1.35,
    box: { minLat: 39.2000, maxLat: 39.4500, minLng: -120.4500, maxLng: -120.1000 },
    cities: ['truckee', 'donner lake', 'soda springs', 'kingvale', 'sierra nevada'],
  },
  snoqualmie_pass: {
    id: 'snoqualmie_pass',
    name: 'Snoqualmie Pass / I-90 Cascade Corridor (WA)',
    multiplier: 1.30,
    box: { minLat: 47.3000, maxLat: 47.5000, minLng: -121.5000, maxLng: -121.3000 },
    cities: ['snoqualmie pass', 'north bend', 'cle elum', 'hyak'],
  },
  vail_pass: {
    id: 'vail_pass',
    name: 'Vail Pass / I-70 Mountain Corridor (CO)',
    multiplier: 1.40,
    box: { minLat: 39.5000, maxLat: 39.7500, minLng: -106.4000, maxLng: -105.8000 },
    cities: ['vail', 'frisco', 'silverthorne', 'copper mountain', 'eisenhower tunnel'],
  },
  cajon_pass: {
    id: 'cajon_pass',
    name: 'Cajon Pass / I-15 High Wind & Grade Zone (CA)',
    multiplier: 1.25,
    box: { minLat: 34.2500, maxLat: 34.4500, minLng: -117.5000, maxLng: -117.3000 },
    cities: ['cajon pass', 'hesperia', 'phelan', 'devore'],
  },
  allegheny_pass: {
    id: 'allegheny_pass',
    name: 'PA Turnpike / Allegheny Mountain Corridor (PA)',
    multiplier: 1.25,
    box: { minLat: 39.9000, maxLat: 40.1500, minLng: -78.9000, maxLng: -78.5000 },
    cities: ['somerset', 'breezewood', 'bedford', 'allegheny tunnel'],
  },
};

export const METRO_CODE_BY_ZONE_ID = {
  ny_nj_pa: 'NYC',
  la_anaheim: 'LA',
  chicago: 'CHI',
  dfw: 'DFW',
  houston: 'HOU',
  atlanta: 'ATL',
  dc_baltimore_va: 'DC',
  philly: 'PHL',
  miami: 'MIA',
  phoenix: 'PHX',
  boston: 'BOS',
  riverside_ie: 'SBD',
  bay_area_sf: 'SFO',
  detroit: 'DET',
  seattle: 'SEA',
  twin_cities: 'MSP',
  tampa: 'TPA',
  san_diego: 'SDG',
  denver: 'DEN',
  orlando: 'ORL',
  charlotte: 'CLT',
  baltimore: 'BMR',
  st_louis: 'STL',
  san_antonio: 'SAT',
  austin: 'AUS',
  portland: 'PRT',
  sacramento: 'SAC',
  pittsburgh: 'PIT',
  las_vegas: 'VEG',
  cincinnati: 'CIN',
  kansas_city: 'KC',
  columbus: 'COL',
  indianapolis: 'IND',
  cleveland: 'CLE',
  nashville: 'NSH',
  san_jose: 'SJO',
  virginia_beach: 'VAB',
  providence: 'PVD',
  jacksonville: 'JAX',
  milwaukee: 'MKE',
  oklahoma_city: 'OKC',
  raleigh: 'RAL',
  memphis: 'MEM',
  richmond: 'RIC',
  louisville: 'LOU',
  salt_lake_city: 'SLC',
  new_orleans: 'NOR',
  hartford: 'HAR',
  buffalo: 'BUF',
  birmingham: 'BHM',
  bridgeport_stamford: 'I95',
  honolulu: 'HNL',
  rochester: 'ROC',
  grand_rapids: 'GRR',
  tucson: 'TUS',
  tulsa: 'TUL',
  omaha: 'OMA',
  fresno: 'FRE',
  albuquerque: 'ABQ',
  el_paso: 'ELP',
};

export const GEOFENCES = {
  // Top 60 US Metropolitan Statistical Areas (MSAs)
  ny_nj_pa: {
    id: 'ny_nj_pa',
    name: 'New York-Newark-Jersey City, NY-NJ-PA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 40.4000, maxLat: 41.3000, minLng: -74.5000, maxLng: -73.5000 },
    cities: [
      'new york, ny', 'brooklyn, ny', 'queens, ny', 'bronx, ny', 'staten island, ny', 
      'manhattan, ny', 'newark, nj', 'jersey city, nj', 'paterson, nj', 'elizabeth, nj', 
      'yonkers, ny', 'white plains, ny', 'stamford, ct'
    ],
  },
  la_anaheim: {
    id: 'la_anaheim',
    name: 'Los Angeles-Long Beach-Anaheim, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 33.6000, maxLat: 34.4000, minLng: -118.7000, maxLng: -117.6000 },
    cities: [
      'los angeles, ca', 'long beach, ca', 'anaheim, ca', 'santa ana, ca', 'irvine, ca', 
      'glendale, ca', 'pasadena, ca', 'torrance, ca', 'pomona, ca', 'orange, ca', 
      'fullerton, ca', 'burbank, ca', 'compton, ca'
    ],
  },
  chicago: {
    id: 'chicago',
    name: 'Chicago-Naperville-Elgin, IL-IN-WI',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.4000, maxLat: 42.3500, minLng: -88.4000, maxLng: -87.5000 },
    cities: [
      'chicago, il', 'naperville, il', 'elgin, il', 'aurora, il', 'joliet, il', 
      'evanston, il', 'schaumburg, il', 'arlington heights, il', 'bolingbrook, il', 
      'gary, in', 'hammond, in', 'kenosha, wi'
    ],
  },
  dfw: {
    id: 'dfw',
    name: 'Dallas-Fort Worth-Arlington, TX',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 32.3000, maxLat: 33.3500, minLng: -97.5000, maxLng: -96.3000 },
    cities: [
      'dallas, tx', 'fort worth, tx', 'arlington, tx', 'plano, tx', 'irving, tx', 
      'garland, tx', 'grand prairie, tx', 'mckinney, tx', 'frisco, tx', 'carrollton, tx', 
      'denton, tx', 'richardson, tx', 'lewisville, tx', 'mesquite, tx', 'grapevine, tx', 
      'euless, tx', 'bedford, tx', 'rockwall, tx', 'rowlett, tx', 'desoto, tx', 'cedar hill, tx'
    ],
  },
  houston: {
    id: 'houston',
    name: 'Houston-Pasadena-The Woodlands, TX',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 29.5000, maxLat: 30.2500, minLng: -95.9000, maxLng: -95.0000 },
    cities: [
      'houston, tx', 'the woodlands, tx', 'sugar land, tx', 'pasadena, tx', 'pearland, tx', 
      'league city, tx', 'conroe, tx', 'baytown, tx', 'katy, tx', 'spring, tx', 
      'cypress, tx', 'humble, tx', 'friendswood, tx', 'alvin, tx', 'bellaire, tx', 'missouri city, tx'
    ],
  },
  atlanta: {
    id: 'atlanta',
    name: 'Atlanta-Sandy Springs-Alpharetta, GA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 33.4000, maxLat: 34.2000, minLng: -84.7000, maxLng: -84.0000 },
    cities: [
      'atlanta, ga', 'sandy springs, ga', 'alpharetta, ga', 'roswell, ga', 'marietta, ga', 
      'duluth, ga', 'lawrenceville, ga', 'smyrna, ga', 'norcross, ga', 'kennesaw, ga', 
      'decatur, ga', 'cumming, ga'
    ],
  },
  dc_baltimore_va: {
    id: 'dc_baltimore_va',
    name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.6000, maxLat: 39.2000, minLng: -77.5000, maxLng: -76.8000 },
    cities: [
      'washington, dc', 'arlington, va', 'alexandria, va', 'fairfax, va', 'silver spring, md', 
      'rockville, md', 'bethesda, md', 'gaithersburg, md', 'reston, va', 'mclean, va', 
      'woodbridge, va', 'fredericksburg, va'
    ],
  },
  philly: {
    id: 'philly',
    name: 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 39.7000, maxLat: 40.3000, minLng: -75.6000, maxLng: -74.9000 },
    cities: [
      'philadelphia, pa', 'camden, nj', 'wilmington, de', 'trenton, nj', 'king of prussia, pa', 
      'norristown, pa', 'chester, pa', 'cherry hill, nj', 'upper darby, pa', 'bensalem, pa'
    ],
  },
  miami: {
    id: 'miami',
    name: 'Miami-Fort Lauderdale-Pompano Beach, FL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 25.5000, maxLat: 26.4000, minLng: -80.4500, maxLng: -80.0500 },
    cities: [
      'miami, fl', 'fort lauderdale, fl', 'pompano beach, fl', 'hialeah, fl', 'boca raton, fl', 
      'west palm beach, fl', 'hollywood, fl', 'coral springs, fl', 'pembroke pines, fl', 
      'miramar, fl', 'homestead, fl', 'boynton beach, fl'
    ],
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix-Mesa-Chandler, AZ',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 33.1500, maxLat: 33.8500, minLng: -112.4000, maxLng: -111.5000 },
    cities: [
      'phoenix, az', 'mesa, az', 'chandler, az', 'scottsdale, az', 'glendale, az', 
      'gilbert, az', 'tempe, az', 'peoria, az', 'surprise, az', 'avondale, az', 'goodyear, az'
    ],
  },
  boston: {
    id: 'boston',
    name: 'Boston-Cambridge-Newton, MA-NH',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 42.1500, maxLat: 42.6000, minLng: -71.3500, maxLng: -70.8000 },
    cities: [
      'boston, ma', 'cambridge, ma', 'newton, ma', 'quincy, ma', 'lynn, ma', 
      'somerville, ma', 'waltham, ma', 'malden, ma', 'brookline, ma', 'medford, ma', 
      'peabody, ma', 'nashua, nh'
    ],
  },
  riverside_ie: {
    id: 'riverside_ie',
    name: 'Riverside-San Bernardino-Ontario, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 33.7000, maxLat: 34.3000, minLng: -117.7000, maxLng: -116.8000 },
    cities: [
      'riverside, ca', 'san bernardino, ca', 'ontario, ca', 'corona, ca', 'moreno valley, ca', 
      'fontana, ca', 'rancho cucamonga, ca', 'temecula, ca', 'murrieta, ca', 'victorville, ca', 'chino, ca'
    ],
  },
  bay_area_sf: {
    id: 'bay_area_sf',
    name: 'San Francisco-Oakland-Berkeley, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 37.4000, maxLat: 38.1000, minLng: -122.6000, maxLng: -122.0000 },
    cities: [
      'san francisco, ca', 'oakland, ca', 'berkeley, ca', 'hayward, ca', 'richmond, ca', 
      'daly city, ca', 'san mateo, ca', 'redwood city, ca', 'san rafael, ca', 'vallejo, ca', 'concord, ca'
    ],
  },
  detroit: {
    id: 'detroit',
    name: 'Detroit-Warren-Dearborn, MI',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 42.1000, maxLat: 42.8000, minLng: -83.5000, maxLng: -82.8000 },
    cities: [
      'detroit, mi', 'warren, mi', 'dearborn, mi', 'sterling heights, mi', 'livonia, mi', 
      'troy, mi', 'southfield, mi', 'pontiac, mi', 'rochester hills, mi', 'taylor, mi', 'st. clair shores, mi'
    ],
  },
  seattle: {
    id: 'seattle',
    name: 'Seattle-Tacoma-Bellevue, WA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 47.0500, maxLat: 48.0000, minLng: -122.5000, maxLng: -122.0000 },
    cities: [
      'seattle, wa', 'tacoma, wa', 'bellevue, wa', 'everett, wa', 'renton, wa', 
      'federal way, wa', 'kent, wa', 'lakewood, wa', 'auburn, wa', 'redmond, wa', 
      'kirkland, wa', 'edmonds, wa'
    ],
  },
  twin_cities: {
    id: 'twin_cities',
    name: 'Minneapolis-St. Paul-Bloomington, MN-WI',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 44.7500, maxLat: 45.2500, minLng: -93.6000, maxLng: -92.8000 },
    cities: [
      'minneapolis, mn', 'saint paul, mn', 'st. paul, mn', 'bloomington, mn', 'plymouth, mn', 
      'brooklyn park, mn', 'eagan, mn', 'woodbury, mn', 'maple grove, mn', 'eden prairie, mn', 'coon rapids, mn'
    ],
  },
  tampa: {
    id: 'tampa',
    name: 'Tampa-St. Petersburg-Clearwater, FL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 27.6000, maxLat: 28.2500, minLng: -82.8500, maxLng: -82.2000 },
    cities: [
      'tampa, fl', 'st. petersburg, fl', 'clearwater, fl', 'largo, fl', 'brandon, fl', 
      'riverview, fl', 'town \'n\' country, fl', 'palm harbor, fl', 'spring hill, fl', 'lakeland, fl'
    ],
  },
  san_diego: {
    id: 'san_diego',
    name: 'San Diego-Chula Vista-Carlsbad, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 32.5000, maxLat: 33.3500, minLng: -117.4000, maxLng: -116.8000 },
    cities: [
      'san diego, ca', 'chula vista, ca', 'carlsbad, ca', 'oceanside, ca', 'escondido, ca', 
      'el cajon, ca', 'vista, ca', 'san marcos, ca', 'national city, ca', 'la mesa, ca'
    ],
  },
  denver: {
    id: 'denver',
    name: 'Denver-Aurora-Lakewood, CO',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 39.5000, maxLat: 40.0000, minLng: -105.2000, maxLng: -104.6000 },
    cities: [
      'denver, co', 'aurora, co', 'lakewood, co', 'fort collins, co', 'thornton, co', 
      'arvada, co', 'westminster, co', 'centennial, co', 'boulder, co', 'greeley, co', 
      'longmont, co', 'highlands ranch, co'
    ],
  },
  orlando: {
    id: 'orlando',
    name: 'Orlando-Kissimmee-Sanford, FL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 28.2000, maxLat: 28.8000, minLng: -81.6500, maxLng: -81.0500 },
    cities: [
      'orlando, fl', 'kissimmee, fl', 'sanford, fl', 'altamonte springs, fl', 'apopka, fl', 
      'winter park, fl', 'oviedo, fl', 'clermont, fl', 'winter garden, fl'
    ],
  },
  charlotte: {
    id: 'charlotte',
    name: 'Charlotte-Concord-Gastonia, NC-SC',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.0000, maxLat: 35.5500, minLng: -81.1500, maxLng: -80.5000 },
    cities: [
      'charlotte, nc', 'concord, nc', 'gastonia, nc', 'rock hill, sc', 'huntersville, nc', 
      'kannapolis, nc', 'monroe, nc', 'mooresville, nc', 'matthews, nc'
    ],
  },
  baltimore: {
    id: 'baltimore',
    name: 'Baltimore-Columbia-Towson, MD',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 39.1000, maxLat: 39.6000, minLng: -76.8500, maxLng: -76.3500 },
    cities: [
      'baltimore, md', 'columbia, md', 'towson, md', 'dundalk, md', 'elliott city, md', 
      'glen burnie, md', 'ellicott city, md', 'annapolis, md', 'bel air, md'
    ],
  },
  st_louis: {
    id: 'st_louis',
    name: 'St. Louis, MO-IL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.4000, maxLat: 38.9000, minLng: -90.6500, maxLng: -90.0000 },
    cities: [
      'st. louis, mo', 'saint louis, mo', 'st. charles, mo', 'o\'fallon, mo', 'florissant, mo', 
      'belleville, il', 'chesterfield, mo', 'university city, mo', 'ballwin, mo'
    ],
  },
  san_antonio: {
    id: 'san_antonio',
    name: 'San Antonio-New Braunfels, TX',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 29.2000, maxLat: 29.8000, minLng: -98.8000, maxLng: -98.1500 },
    cities: [
      'san antonio, tx', 'new braunfels, tx', 'schertz, tx', 'cibolo, tx', 'converse, tx', 
      'universal city, tx', 'seguin, tx', 'helotes, tx'
    ],
  },
  austin: {
    id: 'austin',
    name: 'Austin-Round Rock-Georgetown, TX',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 30.0500, maxLat: 30.6500, minLng: -98.0000, maxLng: -97.4000 },
    cities: [
      'austin, tx', 'round rock, tx', 'georgetown, tx', 'pflugerville, tx', 'san marcos, tx', 
      'cedar park, tx', 'leander, tx', 'kyle, tx', 'buda, tx'
    ],
  },
  portland: {
    id: 'portland',
    name: 'Portland-Vancouver-Hillsboro, OR-WA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 45.3000, maxLat: 45.8000, minLng: -123.0000, maxLng: -122.3500 },
    cities: [
      'portland, or', 'vancouver, wa', 'hillsboro, or', 'gresham, or', 'beaverton, or', 
      'tigard, or', 'lake oswego, or', 'oregon city, or'
    ],
  },
  sacramento: {
    id: 'sacramento',
    name: 'Sacramento-Roseville-Folsom, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.3500, maxLat: 38.8500, minLng: -121.7000, maxLng: -121.1000 },
    cities: [
      'sacramento, ca', 'roseville, ca', 'folsom, ca', 'elk grove, ca', 'citrus heights, ca', 
      'rancho cordova, ca', 'rocklin, ca', 'davis, ca', 'woodland, ca'
    ],
  },
  pittsburgh: {
    id: 'pittsburgh',
    name: 'Pittsburgh, PA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 40.2000, maxLat: 40.6500, minLng: -80.2500, maxLng: -79.7000 },
    cities: [
      'pittsburgh, pa', 'penn hills, pa', 'bethel park, pa', 'monroeville, pa', 
      'cranberry township, pa', 'mccandless, pa', 'allison park, pa'
    ],
  },
  las_vegas: {
    id: 'las_vegas',
    name: 'Las Vegas-Henderson-North Las Vegas, NV',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.9000, maxLat: 36.3500, minLng: -115.4000, maxLng: -114.9000 },
    cities: [
      'las vegas, nv', 'henderson, nv', 'north las vegas, nv', 'enterprise, nv', 
      'spring valley, nv', 'sunrise manor, nv', 'paradise, nv'
    ],
  },
  cincinnati: {
    id: 'cincinnati',
    name: 'Cincinnati, OH-KY-IN',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.9000, maxLat: 39.3500, minLng: -84.7500, maxLng: -84.2000 },
    cities: [
      'cincinnati, oh', 'covington, ky', 'hamilton, oh', 'fairfield, oh', 'florence, ky', 
      'mason, oh', 'norwood, oh', 'middletown, oh'
    ],
  },
  kansas_city: {
    id: 'kansas_city',
    name: 'Kansas City, MO-KS',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.8000, maxLat: 39.3000, minLng: -94.8500, maxLng: -94.3000 },
    cities: [
      'kansas city, mo', 'kansas city, ks', 'overland park, ks', 'olathe, ks', 
      'independence, mo', 'lee\'s summit, mo', 'shawnee, ks', 'blue springs, mo', 'lenexa, ks'
    ],
  },
  columbus: {
    id: 'columbus',
    name: 'Columbus, OH',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 39.8000, maxLat: 40.2000, minLng: -83.2000, maxLng: -82.7000 },
    cities: [
      'columbus, oh', 'dublin, oh', 'westerville, oh', 'grove city, oh', 'reynoldsburg, oh', 
      'delaware, oh', 'gahanna, oh', 'upper arlington, oh'
    ],
  },
  indianapolis: {
    id: 'indianapolis',
    name: 'Indianapolis-Carmel-Anderson, IN',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 39.5500, maxLat: 40.0500, minLng: -86.4000, maxLng: -85.8500 },
    cities: [
      'indianapolis, in', 'carmel, in', 'fishers, in', 'noblesville, in', 'greenwood, in', 
      'lawrence, in', 'anderson, in', 'plainfield, in'
    ],
  },
  cleveland: {
    id: 'cleveland',
    name: 'Cleveland-Elyria, OH',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.2500, maxLat: 41.6500, minLng: -82.1000, maxLng: -81.4000 },
    cities: [
      'cleveland, oh', 'elyria, oh', 'parma, oh', 'lorain, oh', 'lakewood, oh', 
      'euclid, oh', 'mentor, oh', 'cleveland heights, oh', 'strongsville, oh'
    ],
  },
  nashville: {
    id: 'nashville',
    name: 'Nashville-Davidson-Murfreesboro-Franklin, TN',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.8000, maxLat: 36.3500, minLng: -87.0500, maxLng: -86.3500 },
    cities: [
      'nashville, tn', 'davidson, tn', 'murfreesboro, tn', 'franklin, tn', 
      'hendersonville, tn', 'smyrna, tn', 'spring hill, tn', 'lebanon, tn', 'brentwood, tn'
    ],
  },
  san_jose: {
    id: 'san_jose',
    name: 'San Jose-Sunnyvale-Santa Clara, CA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 37.1500, maxLat: 37.5000, minLng: -122.1500, maxLng: -121.7000 },
    cities: [
      'san jose, ca', 'sunnyvale, ca', 'santa clara, ca', 'mountain view, ca', 
      'milpitas, ca', 'palo alto, ca', 'cupertino, ca', 'gilroy, ca'
    ],
  },
  virginia_beach: {
    id: 'virginia_beach',
    name: 'Virginia Beach-Norfolk-Newport News, VA-NC',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 36.6500, maxLat: 37.1500, minLng: -76.6000, maxLng: -75.9500 },
    cities: [
      'virginia beach, va', 'norfolk, va', 'chesapeake, va', 'newport news, va', 
      'hampton, va', 'portsmouth, va', 'suffolk, va'
    ],
  },
  providence: {
    id: 'providence',
    name: 'Providence-Warwick, RI-MA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.6000, maxLat: 42.0000, minLng: -71.6000, maxLng: -71.2000 },
    cities: [
      'providence, ri', 'warwick, ri', 'cranston, ri', 'pawtucket, ri', 
      'east providence, ri', 'woonsocket, ri', 'fall river, ma', 'new bedford, ma'
    ],
  },
  jacksonville: {
    id: 'jacksonville',
    name: 'Jacksonville, FL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 30.0500, maxLat: 30.6000, minLng: -81.9000, maxLng: -81.3500 },
    cities: [
      'jacksonville, fl', 'jacksonville beach, fl', 'st. augustine, fl', 
      'orange park, fl', 'san marco, fl', 'mandarin, fl', 'fleming island, fl'
    ],
  },
  milwaukee: {
    id: 'milwaukee',
    name: 'Milwaukee-Waukesha, WI',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 42.8500, maxLat: 43.2500, minLng: -88.3500, maxLng: -87.8500 },
    cities: [
      'milwaukee, wi', 'waukesha, wi', 'west allis, wi', 'wauwatosa, wi', 
      'brookfield, wi', 'new berlin, wi', 'greenfield, wi'
    ],
  },
  oklahoma_city: {
    id: 'oklahoma_city',
    name: 'Oklahoma City, OK',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.2500, maxLat: 35.7000, minLng: -97.7500, maxLng: -97.2500 },
    cities: [
      'oklahoma city, ok', 'norman, ok', 'edmond, ok', 'moore, ok', 
      'midwest city, ok', 'del city, ok', 'yukon, ok', 'mustang, ok'
    ],
  },
  raleigh: {
    id: 'raleigh',
    name: 'Raleigh-Cary, NC',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.6000, maxLat: 36.0000, minLng: -78.9000, maxLng: -78.4000 },
    cities: [
      'raleigh, nc', 'cary, nc', 'apex, nc', 'wake forest, nc', 
      'holly springs, nc', 'garner, nc', 'durham, nc', 'chapel hill, nc'
    ],
  },
  memphis: {
    id: 'memphis',
    name: 'Memphis, TN-MS-AR',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 34.9000, maxLat: 35.3000, minLng: -90.2500, maxLng: -89.6500 },
    cities: [
      'memphis, tn', 'bartlett, tn', 'collierville, tn', 'germantown, tn', 
      'southaven, ms', 'horn lake, ms', 'west memphis, ar'
    ],
  },
  richmond: {
    id: 'richmond',
    name: 'Richmond, VA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 37.3500, maxLat: 37.7000, minLng: -77.6500, maxLng: -77.2000 },
    cities: [
      'richmond, va', 'henrico, va', 'chesterfield, va', 'midlothian, va', 
      'glen allen, va', 'mechanicsville, va', 'hopewell, va', 'petersburg, va'
    ],
  },
  louisville: {
    id: 'louisville',
    name: 'Louisville/Jefferson County, KY-IN',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 38.0500, maxLat: 38.4000, minLng: -85.9500, maxLng: -85.4500 },
    cities: [
      'louisville, ky', 'jeffersonville, in', 'new albany, in', 'clarksville, in', 
      'jeffersontown, ky', 'st. matthews, ky'
    ],
  },
  salt_lake_city: {
    id: 'salt_lake_city',
    name: 'Salt Lake City, UT',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 40.5000, maxLat: 40.9000, minLng: -112.1000, maxLng: -111.7500 },
    cities: [
      'salt lake city, ut', 'west valley city, ut', 'west jordan, ut', 'sandy, ut', 
      'south jordan, ut', 'taylorsville, ut', 'murray, ut', 'draper, ut'
    ],
  },
  new_orleans: {
    id: 'new_orleans',
    name: 'New Orleans-Metairie, LA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 29.8000, maxLat: 30.1500, minLng: -90.3500, maxLng: -89.8500 },
    cities: [
      'new orleans, la', 'metairie, la', 'kenner, la', 'marrero, la', 
      'harahan, la', 'gretna, la', 'chalmette, la', 'slidell, la'
    ],
  },
  hartford: {
    id: 'hartford',
    name: 'Hartford-East Hartford-Middletown, CT',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.5500, maxLat: 41.9500, minLng: -72.8500, maxLng: -72.4500 },
    cities: [
      'hartford, ct', 'east hartford, ct', 'west hartford, ct', 'new britain, ct', 
      'bristol, ct', 'manchester, ct', 'middletown, ct'
    ],
  },
  buffalo: {
    id: 'buffalo',
    name: 'Buffalo-Cheektowaga, NY',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 42.7000, maxLat: 43.1000, minLng: -78.9500, maxLng: -78.5500 },
    cities: [
      'buffalo, ny', 'cheektowaga, ny', 'amherst, ny', 'tonawanda, ny', 
      'niagara falls, ny', 'west seneca, ny', 'lackawanna, ny'
    ],
  },
  birmingham: {
    id: 'birmingham',
    name: 'Birmingham-Hoover, AL',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 33.3000, maxLat: 33.7000, minLng: -86.9500, maxLng: -86.5500 },
    cities: [
      'birmingham, al', 'hoover, al', 'vestavia hills, al', 'alabaster, al', 
      'bessemer, al', 'homewood, al', 'trussville, al'
    ],
  },
  bridgeport_stamford: {
    id: 'bridgeport_stamford',
    name: 'Bridgeport-Stamford-Norwalk, CT (I-95 Corridor)',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.0000, maxLat: 41.3500, minLng: -73.6500, maxLng: -73.1000 },
    cities: [
      'bridgeport, ct', 'stamford, ct', 'norwalk, ct', 'danbury, ct', 
      'greenwich, ct', 'fairfield, ct', 'stratford, ct', 'westport, ct'
    ],
  },
  honolulu: {
    id: 'honolulu',
    name: 'Honolulu, HI (H-1 Corridor)',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 21.2500, maxLat: 21.4500, minLng: -158.1000, maxLng: -157.7000 },
    cities: [
      'honolulu, hi', 'pearl city, hi', 'waipahu, hi', 'kailua, hi', 
      'kaneohe, hi', 'ewa beach, hi', 'mililani, hi', 'kapolei, hi'
    ],
  },
  rochester: {
    id: 'rochester',
    name: 'Rochester, NY',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 43.0000, maxLat: 43.3000, minLng: -77.7500, maxLng: -77.4000 },
    cities: [
      'rochester, ny', 'greece, ny', 'irondequoit, ny', 'henrietta, ny', 
      'webster, ny', 'penfield, ny', 'fairport, ny'
    ],
  },
  grand_rapids: {
    id: 'grand_rapids',
    name: 'Grand Rapids-Kentwood, MI',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 42.7500, maxLat: 43.1500, minLng: -85.8000, maxLng: -85.4500 },
    cities: [
      'grand rapids, mi', 'kentwood, mi', 'wyoming, mi', 'walker, mi', 
      'holland, mi', 'forest hills, mi'
    ],
  },
  tucson: {
    id: 'tucson',
    name: 'Tucson, AZ',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 32.0000, maxLat: 32.4500, minLng: -111.1500, maxLng: -110.7500 },
    cities: [
      'tucson, az', 'marana, az', 'oro valley, az', 'sahuarita, az', 'south tucson, az'
    ],
  },
  tulsa: {
    id: 'tulsa',
    name: 'Tulsa, OK',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 35.9500, maxLat: 36.3000, minLng: -96.1000, maxLng: -95.7000 },
    cities: [
      'tulsa, ok', 'broken arrow, ok', 'owasso, ok', 'bixby, ok', 
      'jenks, ok', 'sapulpa, ok', 'sand springs, ok'
    ],
  },
  omaha: {
    id: 'omaha',
    name: 'Omaha, NE-IA',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 41.1000, maxLat: 41.4000, minLng: -96.1500, maxLng: -95.8000 },
    cities: [
      'omaha, ne', 'council bluffs, ia', 'bellevue, ne', 'papillion, ne', 'la vista, ne', 'gretna, ne'
    ],
  },
  fresno: {
    id: 'fresno',
    name: 'Fresno, CA (Central Valley Freight)',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 36.6000, maxLat: 36.9500, minLng: -119.9500, maxLng: -119.6000 },
    cities: [
      'fresno, ca', 'clovis, ca', 'sanger, ca', 'reedley, ca', 'selma, ca', 'kerman, ca'
    ],
  },
  albuquerque: {
    id: 'albuquerque',
    name: 'Albuquerque, NM (I-40 / I-25 Corridor)',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 34.9500, maxLat: 35.3000, minLng: -106.8000, maxLng: -106.4000 },
    cities: [
      'albuquerque, nm', 'rio rancho, nm', 'south valley, nm', 'los lunas, nm', 'bernalillo, nm'
    ],
  },
  el_paso: {
    id: 'el_paso',
    name: 'El Paso, TX (Border Freight)',
    multiplier: METRO_MULTIPLIER,
    box: { minLat: 31.6000, maxLat: 31.9500, minLng: -106.6000, maxLng: -106.2000 },
    cities: [
      'el paso, tx', 'socorro, tx', 'horizon city, tx', 'san elizario, tx', 'canutillo, tx'
    ],
  },
};
