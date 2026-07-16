import { createFileRoute } from "@tanstack/react-router";
import AbyssAnchor from "@/components/AbyssAnchor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AQUADIVE — Real-Time Crash Game" },
      {
        name: "description",
        content:
          "AQUADIVE — plunge into the deep, ride the multiplier, and cash out before the chain snaps. A real-time ocean crash game.",
      },
      { property: "og:title", content: "AQUADIVE — Real-Time Crash Game" },
      {
        property: "og:description",
        content:
          "Plunge into the deep, ride the multiplier, cash out before the chain snaps.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <AbyssAnchor />;
}
