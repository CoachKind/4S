import { useEffect, useState } from "react";
import { api, ApiError } from "./lib/api";
import { DEFAULT_OPTIONS } from "./lib/labels";
import type { Session, SessionSetup, SetupOptions } from "./lib/types";
import { DebriefScreen } from "./screens/DebriefScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SimulationScreen } from "./screens/SimulationScreen";

type Phase = { name: "setup" } | { name: "simulation"; session: Session } | { name: "debrief"; session: Session };

export function App() {
  const [options, setOptions] = useState<SetupOptions>(DEFAULT_OPTIONS);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Remount the setup screen with fresh state after each run.
  const [setupKey, setSetupKey] = useState(0);

  useEffect(() => {
    api.options().then(setOptions).catch(() => undefined);
  }, []);

  async function start(setup: SessionSetup) {
    setStarting(true);
    setStartError(null);
    try {
      const session = await api.createSession(setup);
      setPhase({ name: "simulation", session });
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : "Could not start the simulation.");
    } finally {
      setStarting(false);
    }
  }

  function restart() {
    setSetupKey((k) => k + 1);
    setPhase({ name: "setup" });
  }

  switch (phase.name) {
    case "setup":
      return <SetupScreen key={setupKey} options={options} starting={starting} startError={startError} onStart={start} />;
    case "simulation":
      return (
        <SimulationScreen
          key={phase.session.id}
          session={phase.session}
          options={options}
          onDebriefed={(session) => setPhase({ name: "debrief", session })}
        />
      );
    case "debrief":
      return <DebriefScreen session={phase.session} options={options} onRestart={restart} />;
  }
}
