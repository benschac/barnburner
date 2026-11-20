import type { LabEntry } from "@nhl-reddit-stats/viz";
import { samples } from "@nhl-reddit-stats/viz/samples";
import type { ReactNode } from "react";

const { hops } = samples.chain.tables;

const entry: LabEntry<ReactNode> = {
  title: "Hello: the chain sample as a table",
  render: () => (
    <table>
      <thead>
        <tr>
          <th>chain</th>
          <th>step</th>
          <th>from</th>
          <th>to</th>
          <th>games</th>
        </tr>
      </thead>
      <tbody>
        {hops.map((hop) => (
          <tr key={`${hop.chain}-${hop.step}`}>
            <td>{hop.chain}</td>
            <td>{hop.step}</td>
            <td>{hop.from}</td>
            <td>{hop.to}</td>
            <td>{hop.games}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export default entry;
