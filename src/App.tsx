import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { View } from "tamagui";
import { Chart } from "./Charts";
import { divisions, leaders, recent, standings, upcoming } from "./stats";
import type { Matchup } from "./stats";

function TeamLogo({
  team,
  alternate = false,
  className = "",
}: {
  team: string;
  alternate?: boolean;
  className?: string;
}) {
  return (
    <img
      className={`team-logo ${className}`}
      src={`/assets/teams/${team}${alternate && team === 'WSH' ? '-alt' : ''}.svg`}
      alt={team}
    />
  );
}

function Division({
  name,
  record,
  teams,
}: {
  name: string;
  record: string;
  teams: Matchup[];
}) {
  return (
    <section className="division" aria-label={`${name} division matchups`}>
      <h3 className="division-heading">
        <span>{name}</span>
        <span className="division-record">{record}</span>
      </h3>
      <ul className="matchups">
        {teams.map(({ team, games }) => (
          <li className="matchup" key={team}>
            <TeamLogo team={team} alternate />
            <div className="matchup-games">
              {games.map(({ venue, outcome }, index) => (
                <span
                  key={index}
                  className={`venue-icon ${venue} ${outcome}`}
                  role="img"
                  aria-label={`${venue}, ${outcome === "pending" ? "still to play" : outcome}`}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayoffPicture() {
  return (
    <section className="playoff-picture" aria-labelledby="playoff-heading">
      <h2 className="ruled-heading" id="playoff-heading">
        Playoff picture
      </h2>
      <table className="standings">
      <colgroup><col style={{ width: 51 }} /><col style={{ width: 163 }} /><col style={{ width: 40 }} /><col style={{ width: 45 }} /></colgroup>
        <thead>
          <tr>
            <th colSpan={2} scope="colgroup">
              METROPOLITAN
            </th>
            <th scope="col">GP</th>
            <th scope="col">PTS</th>
          </tr>
        </thead>
        <tbody>
          {standings.map(({ seed, team, played, points }, index) => (
            <Fragment key={team}>
              {index === 3 && (
                <tr className="wild-card-label">
                  <th colSpan={4} scope="colgroup">
                    WILD CARD
                  </th>
                </tr>
              )}
              <tr
                className={`${team === "NJD" ? "our-team" : ""} ${index === 5 ? "below-cutoff" : ""}`}
              >
                <td className="seed">{seed}</td>
                <th scope="row" className="standing-team">
                  <TeamLogo team={team} />
                  <span>{team}</span>
                </th>
                <td className="games-played">{played}</td>
                <td className="points">{points}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="special-teams">
        <div>
          <h3>POWER PLAY</h3>
          <p className="rank">· 24th of 32</p>
          <p className="percentage">
            18.5<span>%</span>
          </p>
        </div>
        <div>
          <h3>PENALTY KILL</h3>
          <p className="rank">· 29th of 32</p>
          <p className="percentage">
            67.6<span>%</span>
          </p>
        </div>
      </div>
      <section className="leaders" aria-labelledby="leaders-heading">
        <h2 className="ruled-heading" id="leaders-heading">
          Team leaders
        </h2>
        <ul>
          {leaders.map((leader) => (
            <li className="leader" key={leader.label}>
              <img
                className="portrait"
                src={`/assets/players/${leader.portrait}.png`}
                alt=""
              />
              <div className="leader-details">
                <h3>{leader.label}</h3>
                <p className="leader-name">{leader.name}</p>
                <p className="leader-description">{leader.detail}</p>
              </div>
              <p className="leader-value">{leader.value}</p>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function Schedule() {
  return (
    <div className="schedule">
      <section aria-labelledby="next-heading">
        <h2 className="ruled-heading schedule-heading" id="next-heading">
          Next 5<span>EASTERN TIME</span>
        </h2>
        <ol className="upcoming">
          {upcoming.map((game) => (
            <li key={game.date} className="upcoming-game">
              <div className="game-date">
                <span className="weekday">{game.day}</span>
                <span className="day-number">{game.date}</span>
              </div>
              <span className="game-venue">{game.venue}</span>
              <TeamLogo team={game.team} alternate />
              <span className="game-time">{game.time}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="recent" aria-labelledby="last-heading">
        <h2 className="ruled-heading" id="last-heading">
          Last 5
        </h2>
        <ol>
          {recent.map((game) => (
            <li className="recent-game" key={game.team}>
              <TeamLogo team={game.team} />
              <span className={`result ${game.outcome}`}>
                {game.outcome === "win" ? "W" : "L"}
              </span>
              <span className="score">{game.score}</span>
              <span className="extra-time">{game.extra}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / 1206);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  return (
    <View render="main" minH="100vh" backgroundColor="#000000" items="center">
      <div className="poster-shell" ref={shellRef}>
        <article
          className="poster"
          style={{ transform: `scale(${scale})` }}
          aria-label="New Jersey Devils season at a glance — November 8"
        >
          <header className="team-header">
            <div className="team-banner">
              <TeamLogo team="NJD" />
            </div>
            <div className="season-record">
              <h1>12-5-0</h1>
              <p>
                <strong>24 points,</strong> 2nd in the Metropolitan, won 4
                straight
              </p>
            </div>
            <div className="season-summary">
              <p className="snapshot-date">Sunday, November 8</p>
              <p>Home 8-2-0 · Road 4-3-0 · Last 10 8-2-0</p>
              <p>Schedule left: 13th-toughest of 32</p>
            </div>
          </header>
          <div className="poster-content">
            <section className="season-chart" aria-labelledby="season-heading">
              <div className="chart-heading">
                <h2 id="season-heading">The season, game by game</h2>
                <p>17 of 84 played, bar height = goal margin</p>
              </div>
              <Chart kind="season" />
            </section>
            <section className="playoff-chart" aria-labelledby="line-heading">
              <div className="chart-heading">
                <h2 id="line-heading">
                  Playoff line <span className="playoff-margin">+5</span>
                </h2>
                <p>5 points clear of the first team out</p>
              </div>
              <Chart kind="playoff" />
            </section>
            <div className="details-grid">
              <div className="divisions">
                {divisions.map((division) => (
                  <Division {...division} key={division.name} />
                ))}
              </div>
              <PlayoffPicture />
              <Schedule />
            </div>
            <footer className="legend">
              <ul>
                <li>
                  <i className="win" />
                  Win
                </li>
                <li>
                  <i className="loss" />
                  Loss
                </li>
                <li>
                  <i className="overtime" />
                  OT/SO loss
                </li>
                <li>
                  <i className="pending" />
                  Still to play
                </li>
              </ul>
              <p>Filled dot or house = home, ring or plane = away</p>
              <span className="wordmark">GLANCEBOARD</span>
            </footer>
          </div>
        </article>
      </div>
    </View>
  );
}
