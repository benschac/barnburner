import type { ReactNode } from "react";

import "@tamagui/core/reset.css";
import "../src/tamagui.generated.css";

export const metadata = {
  title: "NHL — Season at a Glance",
  description:
    "Season-at-a-glance posters for all 32 NHL teams, with results, standings, schedules, and player leaders from NHL snapshots.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions such as Grammarly add body attributes before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
