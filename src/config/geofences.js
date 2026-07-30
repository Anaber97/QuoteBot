export const GEOFENCES = {
  dfw: {
    id: 'dfw',
    label: '+28.57% DFW Zone',
    multiplier: 1.2857,
    box: {
      minLat: 32.3000,
      maxLat: 33.3500,
      minLng: -97.5000,
      maxLng: -96.3000,
    },
    cities: [
      'dallas', 'fort worth', 'arlington', 'plano', 'irving', 'garland', 
      'grand prairie', 'mckinney', 'frisco', 'carrollton', 'denton', 
      'richardson', 'lewisville', 'mesquite', 'grapevine', 'euless', 
      'bedford', 'hurst', 'rockwall', 'rowlett', 'desoto', 'cedar hill'
    ],
  },
  houston: {
    id: 'houston',
    label: '+28.57% Houston Metro',
    multiplier: 1.2857,
    box: {
      minLat: 29.5000,
      maxLat: 30.1500,
      minLng: -95.8000,
      maxLng: -95.0000,
    },
    cities: [
      'houston', 'the woodlands', 'sugar land', 'pasadena', 'pearland',
      'league city', 'conroe', 'baytown', 'katy', 'spring', 'cypress',
      'humble', 'friendswood', 'alvin', 'bellaire', 'missouri city'
    ],
  },
};