const BLACK = 'color16';
const BLUE = 'color18';
const RED = 'color88';
const BROWN = 'color100';
const LIGHTGRAY = 'color250';
const WHITE = 'color231';

const NEWT_COLOR_ENTRIES = [
  `root=${WHITE},${BLUE}`,
  `border=${BLACK},${LIGHTGRAY}`,
  `window=${BLACK},${LIGHTGRAY}`,
  `shadow=${WHITE},${BLACK}`,
  `title=${RED},${LIGHTGRAY}`,
  `button=${LIGHTGRAY},${RED}`,
  `actbutton=${RED},${LIGHTGRAY}`,
  `checkbox=${LIGHTGRAY},${BLUE}`,
  `actcheckbox=${LIGHTGRAY},${RED}`,
  `entry=${LIGHTGRAY},${BLUE}`,
  `label=${BLUE},${LIGHTGRAY}`,
  `listbox=${BLACK},${LIGHTGRAY}`,
  `actlistbox=${LIGHTGRAY},${BLUE}`,
  `textbox=${BLACK},${LIGHTGRAY}`,
  `acttextbox=${LIGHTGRAY},${RED}`,
  `helpline=${WHITE},${BLUE}`,
  `roottext=${LIGHTGRAY},${BLUE}`,
  `fullscale=,${BLUE}`,
  `emptyscale=,${RED}`,
  `disentry=${BLUE},${LIGHTGRAY}`,
  `compactbutton=${BLACK},${LIGHTGRAY}`,
  `actsellistbox=${LIGHTGRAY},${RED}`,
  `sellistbox=${BLACK},${BROWN}`,
];

export const NEWT_COLORS_VALUE = NEWT_COLOR_ENTRIES.join(' ');

export const NEWT_COLORS_EXPORT = `export NEWT_COLORS='${NEWT_COLORS_VALUE}'`;
