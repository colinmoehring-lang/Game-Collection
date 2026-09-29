import type { DistrictType, FieldDefinition } from './types.js';

/**
 * 40 standard fields for MetroVille (Retrofuturistic 1960s Mid-Century theme)
 */
export const METROVILLE_FIELDS: FieldDefinition[] = [
  // 0: Stadttor (Start / Los)
  { index: 0, name: 'Stadttor', type: 'corner' },

  // Altstadt (Teal)
  {
    index: 1, name: 'Alte Allee', type: 'property', district: 'altstadt', color: '#1D7A72',
    cost: 60, baseRent: 2, rents: [2, 10, 30, 90, 160, 250], houseCost: 50
  },
  { index: 2, name: 'Stadtrat-Beschluss', type: 'card' },
  {
    index: 3, name: 'Lindenweg', type: 'property', district: 'altstadt', color: '#1D7A72',
    cost: 60, baseRent: 4, rents: [4, 20, 60, 180, 320, 450], houseCost: 50
  },
  { index: 4, name: 'Bürgersteuer', type: 'tax', taxAmount: 200 },

  // Station 1
  { index: 5, name: 'Bahnhof Süd', type: 'station', cost: 200, baseRent: 25 },

  // Zentrum (Mustard)
  {
    index: 6, name: 'Hauptplatz', type: 'property', district: 'zentrum', color: '#D4930A',
    cost: 100, baseRent: 6, rents: [6, 30, 90, 270, 400, 550], houseCost: 50
  },
  { index: 7, name: 'Expresskurier', type: 'card' },
  {
    index: 8, name: 'Ratsherrenstraße', type: 'property', district: 'zentrum', color: '#D4930A',
    cost: 100, baseRent: 6, rents: [6, 30, 90, 270, 400, 550], houseCost: 50
  },
  {
    index: 9, name: 'Botanikerstraße', type: 'property', district: 'zentrum', color: '#D4930A',
    cost: 120, baseRent: 8, rents: [8, 40, 100, 300, 450, 600], houseCost: 50
  },

  // 10: Sicherheitszone (Jail / Besuch)
  { index: 10, name: 'Sicherheitszone', type: 'corner' },

  // Neonviertel (Terracotta)
  {
    index: 11, name: 'Neonboulevard', type: 'property', district: 'neonviertel', color: '#C84B2F',
    cost: 140, baseRent: 10, rents: [10, 50, 150, 450, 625, 750], houseCost: 100
  },
  { index: 12, name: 'Atomreaktor', type: 'utility', cost: 150, baseRent: 10 },
  {
    index: 13, name: 'Lichtallee', type: 'property', district: 'neonviertel', color: '#C84B2F',
    cost: 140, baseRent: 10, rents: [10, 50, 150, 450, 625, 750], houseCost: 100
  },
  {
    index: 14, name: 'Kaiserstraße', type: 'property', district: 'neonviertel', color: '#C84B2F',
    cost: 160, baseRent: 12, rents: [12, 60, 180, 500, 700, 900], houseCost: 100
  },

  // Station 2
  { index: 15, name: 'Bahnhof West', type: 'station', cost: 200, baseRent: 25 },

  // Hafenviertel (Sky Blue)
  {
    index: 16, name: 'Turmstraße', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 180, baseRent: 14, rents: [14, 70, 200, 550, 750, 950], houseCost: 100
  },
  { index: 17, name: 'Stadtrat-Beschluss', type: 'card' },
  {
    index: 18, name: 'Dockallee', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 180, baseRent: 14, rents: [14, 70, 200, 550, 750, 950], houseCost: 100
  },
  {
    index: 19, name: 'Werftstraße', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 200, baseRent: 16, rents: [16, 80, 220, 600, 800, 1000], houseCost: 100
  },

  // 20: Freier Stadtpark (Parken)
  { index: 20, name: 'Freier Stadtpark', type: 'corner' },

  // Polardistrikt (Amber)
  {
    index: 21, name: 'Eispalast', type: 'property', district: 'polardistrikt', color: '#D97706',
    cost: 220, baseRent: 18, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150
  },
  { index: 22, name: 'Expresskurier', type: 'card' },
  {
    index: 23, name: 'Polarboulevard', type: 'property', district: 'polardistrikt', color: '#D97706',
    cost: 220, baseRent: 18, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150
  },
  {
    index: 24, name: 'Nordhavn', type: 'property', district: 'polardistrikt', color: '#D97706',
    cost: 240, baseRent: 20, rents: [20, 100, 300, 750, 925, 1100], houseCost: 150
  },

  // Station 3
  { index: 25, name: 'Bahnhof Nord', type: 'station', cost: 200, baseRent: 25 },

  // Weltraumring (Purple)
  {
    index: 26, name: 'Gartenstraße', type: 'property', district: 'weltraumring', color: '#8B5CF6',
    cost: 260, baseRent: 22, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150
  },
  {
    index: 27, name: 'Sternboulevard', type: 'property', district: 'weltraumring', color: '#8B5CF6',
    cost: 260, baseRent: 22, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150
  },
  { index: 28, name: 'Satellitennetz', type: 'utility', cost: 150, baseRent: 10 },
  {
    index: 29, name: 'Quasarstraße', type: 'property', district: 'weltraumring', color: '#8B5CF6',
    cost: 280, baseRent: 24, rents: [24, 120, 360, 850, 1025, 1200], houseCost: 150
  },

  // 30: Ins Quarantäne-Sektor gehen (Gehe ins Gefängnis)
  { index: 30, name: 'Quarantäne-Befehl', type: 'corner' },

  // Weitere Quartierstraßen (Kristall & High-End)
  {
    index: 31, name: 'Kristallstraße', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 300, baseRent: 26, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200
  },
  {
    index: 32, name: 'Hafenblick', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 300, baseRent: 26, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200
  },
  { index: 33, name: 'Stadtrat-Beschluss', type: 'card' },
  {
    index: 34, name: 'Ankerkai', type: 'property', district: 'hafenviertel', color: '#3B7FC4',
    cost: 320, baseRent: 28, rents: [28, 150, 450, 1000, 1200, 1400], houseCost: 200
  },

  // Station 4
  { index: 35, name: 'Bahnhof Ost', type: 'station', cost: 200, baseRent: 25 },

  { index: 36, name: 'Expresskurier', type: 'card' },
  {
    index: 37, name: 'Raumhafen-Boulevard', type: 'property', district: 'weltraumring', color: '#8B5CF6',
    cost: 350, baseRent: 35, rents: [35, 175, 500, 1100, 1300, 1500], houseCost: 200
  },
  { index: 38, name: 'Infrastrukturabgabe', type: 'tax', taxAmount: 100 },
  {
    index: 39, name: 'Orbitalkai', type: 'property', district: 'weltraumring', color: '#8B5CF6',
    cost: 400, baseRent: 50, rents: [50, 200, 600, 1400, 1700, 2000], houseCost: 200
  }
];

export const DISTRICT_MAP: Record<DistrictType, number[]> = {
  altstadt: [1, 3],
  zentrum: [6, 8, 9],
  neonviertel: [11, 13, 14],
  hafenviertel: [16, 18, 19, 31, 32, 34],
  polardistrikt: [21, 23, 24],
  weltraumring: [26, 27, 29, 37, 39],
  station: [5, 15, 25, 35],
  utility: [12, 28],
  special: [0, 2, 4, 7, 10, 17, 20, 22, 30, 33, 36, 38]
};
