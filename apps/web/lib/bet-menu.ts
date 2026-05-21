export type BetMenuEntry = {
  slug: string;
  label: string;
  blurb: string;
  resolves: string;
  live: boolean;
};

export const BET_MENU: BetMenuEntry[] = [
  // Head-to-head micro-races first — the actual game
  {
    slug: 'landing-race',
    label: 'Landing Race',
    blurb: 'Two planes on final at the same airport, ETA Δ ≤ 60s. Who touches down first?',
    resolves: 'minutes',
    live: true,
  },
  {
    slug: 'takeoff-race',
    label: 'Takeoff Race',
    blurb: 'Two aircraft in the same airport\'s departure queue. Who rotates first?',
    resolves: 'minutes',
    live: true,
  },
  {
    slug: 'cross-airport-race',
    label: 'Cross-Airport Race',
    blurb: 'One inbound at each of two airports, ETA Δ ≤ 60s. Whose plane lands first?',
    resolves: 'minutes',
    live: true,
  },
  {
    slug: 'heavy-race',
    label: 'Heavy Race',
    blurb: 'Two airports — whose next heavy widebody movement happens first?',
    resolves: 'minutes',
    live: true,
  },
  // Quick aggregate bets (resolve on first matching event anywhere)
  {
    slug: 'next-takeoff',
    label: 'Next Takeoff',
    blurb: 'Pick which of the 4 airports gets the next takeoff event.',
    resolves: 'seconds',
    live: true,
  },
  {
    slug: 'next-heavy',
    label: 'Next Heavy',
    blurb: 'Pick which of the 4 airports gets the next heavy movement.',
    resolves: 'minutes',
    live: true,
  },
  // For the patient — hourly tallies
  {
    slug: 'race-winner',
    label: 'Race Winner',
    blurb: 'Pick the airport that wins this hour\'s race. Resolves at top of hour.',
    resolves: 'top of hour',
    live: true,
  },
  {
    slug: 'race-ou',
    label: 'Race O/U',
    blurb: 'Over or under an airport\'s hourly count line.',
    resolves: 'top of hour',
    live: true,
  },
  // Not built yet
  {
    slug: 'ou-10',
    label: '10-Min O/U',
    blurb: 'Over/under a 10-minute rolling takeoff count.',
    resolves: '10 min',
    live: false,
  },
  {
    slug: 'streak',
    label: 'Streak',
    blurb: 'Will the next 3 takeoffs all come from the same airport?',
    resolves: 'minutes',
    live: false,
  },
  {
    slug: 'margin',
    label: 'Margin',
    blurb: 'Predict the winning margin of an hourly race.',
    resolves: 'top of hour',
    live: false,
  },
];
