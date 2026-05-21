const WORDS = [
  // NATO
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL',
  'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA',
  'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY',
  'XRAY', 'YANKEE', 'ZULU',
  // Aviation flavor
  'RADAR', 'RUNWAY', 'MAYDAY', 'SQUAWK', 'CARGO', 'JUMBO', 'TURBO', 'PROP',
  'MACH', 'NAUTICAL', 'JETSET', 'CLIPPER', 'PHANTOM', 'GHOST', 'STORM', 'BLAZE',
  // NYC nods (matching the campaign's NYC week)
  'BROOKLYN', 'BRONX', 'QUEENS', 'HARLEM', 'TRIBECA', 'CHELSEA', 'MIDTOWN',
  'GOWANUS', 'BUSHWICK', 'ASTORIA', 'INWOOD', 'SOHO', 'NOMAD', 'DUMBO',
];

export const generateCallsign = (): string => {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(Math.random() * 900) + 100; // 100..999
  return `${word}${num}`;
};
