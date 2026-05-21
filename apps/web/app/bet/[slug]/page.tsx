import { notFound } from 'next/navigation';
import {
  getActiveBetsForUser,
  getCrossAirportRaces,
  getCurrentHourScores,
  getLandingRacesForAirport,
  getPaceByAirport,
  getTakeoffRacesForAirport,
  getTodayTotals,
  listHeavyRacePairs,
} from '@airport-pong/db';
import { AIRPORT_CODES, getFeatureMatchup } from '@airport-pong/shared';
import { getCurrentUser } from '../../../lib/session';
import { TopBar } from '../../_components/TopBar';
import { BetPageShell } from '../../_components/bets/BetPageShell';
import { NextTakeoffForm } from '../../_components/bets/NextTakeoffForm';
import { NextHeavyForm } from '../../_components/bets/NextHeavyForm';
import { RaceWinnerForm } from '../../_components/bets/RaceWinnerForm';
import { RaceOuForm } from '../../_components/bets/RaceOuForm';
import { LandingRaceForm } from '../../_components/bets/LandingRaceForm';
import { TakeoffRaceForm } from '../../_components/bets/TakeoffRaceForm';
import { CrossAirportRaceForm } from '../../_components/bets/CrossAirportRaceForm';
import { HeavyRaceForm } from '../../_components/bets/HeavyRaceForm';
import type { ActiveBet } from '../../_components/ActiveBets';

export const dynamic = 'force-dynamic';

const SUPPORTED = [
  'next-takeoff',
  'next-heavy',
  'race-winner',
  'race-ou',
  'landing-race',
  'takeoff-race',
  'cross-airport-race',
  'heavy-race',
] as const;
type Slug = (typeof SUPPORTED)[number];

export default async function BetSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!SUPPORTED.includes(slug as Slug)) notFound();

  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="page-shell">
        <div className="container">Setting up your callsign… refresh.</div>
      </main>
    );
  }

  const userBets = await getActiveBetsForUser(user.id);
  const bets: ActiveBet[] = userBets.map((b) => ({
    id: b.id,
    betType: b.betType,
    betPayload: b.betPayload,
    stake: b.stake,
    potentialPayout: b.potentialPayout,
    status: b.status,
    placedAt: b.placedAt.toISOString(),
    resolvedAt: b.resolvedAt ? b.resolvedAt.toISOString() : null,
  }));

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '56px 1fr',
        background: 'var(--bg-0)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <TopBar callsign={user.callsign} balance={user.balance} active="bets" />
      <main className="page-shell" style={{ overflow: 'auto', padding: '24px 0 80px' }}>
        <FormForSlug slug={slug as Slug} bets={bets} balance={user.balance} />
      </main>
    </div>
  );
}

async function FormForSlug({
  slug,
  bets,
  balance,
}: {
  slug: Slug;
  bets: ActiveBet[];
  balance: number;
}) {
  if (slug === 'next-takeoff') {
    const [pace, totals] = await Promise.all([
      getPaceByAirport(30, 'takeoff'),
      getTodayTotals(),
    ]);
    return (
      <BetPageShell
        eyebrow="QUICK BET · resolves in seconds"
        title="Next Takeoff"
        blurb="Pick which of the 4 airports gets the very next takeoff event."
        bets={bets}
      >
        <NextTakeoffForm pace={pace} todayTotals={totals} balance={balance} />
      </BetPageShell>
    );
  }
  if (slug === 'next-heavy') {
    const [heavyPace, totals] = await Promise.all([
      getPaceByAirport(60, 'heavy'),
      getTodayTotals(),
    ]);
    return (
      <BetPageShell
        eyebrow="QUICK BET · low frequency"
        title="Next Heavy Movement"
        blurb="Heavies = wide-body aircraft (777, 787, 747, A330+, A350, A380). Pick the airport that sees the next one — takeoff or landing."
        bets={bets}
      >
        <NextHeavyForm heavyPace={heavyPace} todayTotals={totals} balance={balance} />
      </BetPageShell>
    );
  }
  if (slug === 'race-winner') {
    const [scores, takeoffPace, heavyPace, totalPace] = await Promise.all([
      getCurrentHourScores(),
      getPaceByAirport(30, 'takeoff'),
      getPaceByAirport(60, 'heavy'),
      getPaceByAirport(30, 'all'),
    ]);
    return (
      <BetPageShell
        eyebrow="HOURLY · resolves at top of hour UTC"
        title="Race Winner"
        blurb="Pick which airport wins one of this hour's 3 races. Standings reset every hour at :00 UTC."
        bets={bets}
      >
        <RaceWinnerForm
          scores={scores}
          takeoffPace={takeoffPace}
          heavyPace={heavyPace}
          totalPace={totalPace}
          balance={balance}
        />
      </BetPageShell>
    );
  }
  if (slug === 'race-ou') {
    const [scores, takeoffPace, heavyPace, totalPace] = await Promise.all([
      getCurrentHourScores(),
      getPaceByAirport(30, 'takeoff'),
      getPaceByAirport(60, 'heavy'),
      getPaceByAirport(30, 'all'),
    ]);
    return (
      <BetPageShell
        eyebrow="HOURLY · resolves at top of hour UTC"
        title="Race Over / Under"
        blurb="Bet that an airport's hourly count finishes above or below an auto-suggested line."
        bets={bets}
      >
        <RaceOuForm
          scores={scores}
          takeoffPace={takeoffPace}
          heavyPace={heavyPace}
          totalPace={totalPace}
          balance={balance}
        />
      </BetPageShell>
    );
  }
  if (slug === 'landing-race') {
    const all = await Promise.all(
      AIRPORT_CODES.map((c) => getLandingRacesForAirport(c))
    );
    const pairs = all.flat();
    return (
      <BetPageShell
        eyebrow="HEAD-TO-HEAD · resolves on first landing"
        title="Landing Race"
        blurb="Two planes on approach to the same airport with ETAs within ~60 seconds of each other. Pick which one touches down first."
        bets={bets}
      >
        <LandingRaceForm initialPairs={pairs} balance={balance} />
      </BetPageShell>
    );
  }
  if (slug === 'takeoff-race') {
    const all = await Promise.all(
      AIRPORT_CODES.map((c) => getTakeoffRacesForAirport(c))
    );
    const pairs = all.flat();
    return (
      <BetPageShell
        eyebrow="HEAD-TO-HEAD · resolves on first takeoff"
        title="Takeoff Race"
        blurb="Two aircraft taxiing fast at the same airport — the front of the departure queue. Pick which one rotates first."
        bets={bets}
      >
        <TakeoffRaceForm initialPairs={pairs} balance={balance} />
      </BetPageShell>
    );
  }
  if (slug === 'cross-airport-race') {
    const pair = getFeatureMatchup();
    const pairs = await getCrossAirportRaces(pair[0], pair[1]);
    return (
      <BetPageShell
        eyebrow="HEAD-TO-HEAD ACROSS AIRPORTS · resolves on first landing"
        title="Cross-Airport Race"
        blurb="A plane inbound to one airport vs a plane inbound to another, ETAs within 60s. Pick which airport gets its arrival down first."
        bets={bets}
      >
        <CrossAirportRaceForm initialPairs={pairs} initialAirportPair={pair} balance={balance} />
      </BetPageShell>
    );
  }
  if (slug === 'heavy-race') {
    const [heavyPace, basePairs] = await Promise.all([
      getPaceByAirport(60, 'heavy'),
      Promise.resolve(listHeavyRacePairs()),
    ]);
    const pairs = basePairs.map((p) => {
      const left = Math.max(0.1, heavyPace[p.leftAirport]);
      const right = Math.max(0.1, heavyPace[p.rightAirport]);
      const total = left + right;
      return {
        ...p,
        leftPace: heavyPace[p.leftAirport],
        rightPace: heavyPace[p.rightAirport],
        probLeft: left / total,
      };
    });
    return (
      <BetPageShell
        eyebrow="HEAD-TO-HEAD · resolves on next heavy at either airport"
        title="Heavy Race"
        blurb="Pick a pair of airports — whichever one gets the next widebody movement (777/787/A330+) wins. Odds weighted by recent heavy pace."
        bets={bets}
      >
        <HeavyRaceForm initialPairs={pairs} balance={balance} />
      </BetPageShell>
    );
  }
  return null;
}
