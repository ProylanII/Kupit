// One shared palette for tiles, sprites and UI. No colors outside this file.
export const C = {
  ink: '#1b1424', white: '#f6f1e7', gray: '#9a94a8', dgray: '#5a5468',
  wallL: '#7d6794', wallD: '#4a3a5f', wallT: '#9d86b8',
  wood: '#c99a5b', wood2: '#bd8d50', woodLine: '#a67a42',
  tile: '#cfdad4', tile2: '#bccbc3',
  rug: '#a8433f', rug2: '#c25a4f', rugEdge: '#f0c36a',
  table: '#7a4a2b', table2: '#9a6238',
  sofa: '#3f7f8c', sofa2: '#5aa3ae',
  bed: '#d96a8c', bed2: '#f3a3bb',
  leaf: '#3f8f4a', leaf2: '#63b564', pot: '#b3623a',
  counter: '#e4dccb', counter2: '#b9ae96', fridge: '#dfe7ee', fridge2: '#9fb0bf',
  skin: '#f2c394', skin2: '#d89f6c',
  gold: '#ffd84d', gold2: '#c9962b', purse: '#8a3b1f', purse2: '#b9562e',
  red: '#ff4b4b', green: '#46e08a', yellow: '#ffe36b', orange: '#ff9a3c',
  blue: '#2f5fbf', pink: '#ff7eb6', purple: '#8a5fb5', teal: '#2fa59b',
};

export const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16),
];
