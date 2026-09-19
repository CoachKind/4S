import { useEffect, useState } from "react";
import { api, ApiError } from "./lib/api";
import { DEFAULT_OPTIONS } from "./lib/labels";
import type { Session, SessionMode, SessionSetupInput, SetupOptions } from "./lib/types";
import { DebriefScreen } from "./screens/DebriefScreen";
import { EmotionalCheckInScreen } from "./screens/EmotionalCheckInScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { SimulationScreen } from "./screens/SimulationScreen";
import { VoiceScreen } from "./screens/VoiceScreen";

// Flow: setup -> checkin (Emotional Check-In, always shown) -> simulation (text or voice) -> debrief.
// The check-in never touches the session; it only gates entry to the simulation.
type Phase =
  | { name: "setup" }
  | { name: "checkin"; session: Session }
  | { name: "simulation"; session: Session }
  | { name: "voice"; session: Session }
  | { name: "debrief"; session: Session };

export function App() {
  const [options, setOptions] = useState<SetupOptions>(DEFAULT_OPTIONS);
  const [phase, setPhase] = useState<Phase>({ name: "setup" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Remount the setup screen with fresh state after each run.
  const [setupKey, setSetupKey] = useState(0);
  const [setupMode, setSetupMode] = useState<SessionMode>("text");

  useEffect(() => {
    api.options().then(setOptions).catch(() => undefined);
  }, []);

  async function start(setup: SessionSetupInput) {
    setStarting(true);
    setStartError(null);
    try {
      const session = await api.createSession(setup);
      setPhase({ name: "checkin", session });
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : "Could not start the simulation.");
    } finally {
      setStarting(false);
    }
  }

  function restart(mode: SessionMode = "text") {
    setSetupMode(mode);
    setSetupKey((k) => k + 1);
    setPhase({ name: "setup" });
  }

  function enterConversation(session: Session) {
    if (session.mode === "voice") setPhase({ name: "voice", session });
    else setPhase({ name: "simulation", session });
  }

  switch (phase.name) {
    case "setup":
      return <SetupScreen key={setupKey} options={options} starting={starting} startError={startError} initialMode={setupMode} onStart={start} />;
    case "checkin":
      return (
        <EmotionalCheckInScreen
          key={phase.session.id}
          otherName={phase.session.setup.simulatedName}
          direction={phase.session.setup.conversationDirection}
          onContinue={() => enterConversation(phase.session)}
        />
      );
    case "simulation":
      return (
        <SimulationScreen
          key={phase.session.id}
          session={phase.session}
          options={options}
          onDebriefed={(session) => setPhase({ name: "debrief", session })}
        />
      );
    case "voice":
      return (
        <VoiceScreen
          key={phase.session.id}
          session={phase.session}
          options={options}
          onDebriefed={(session) => setPhase({ name: "debrief", session })}
          onSwitchToText={(session) => setPhase({ name: "simulation", session })}
          onMicDenied={() => restart("text")}
        />
      );
    case "debrief":
      return <DebriefScreen session={phase.session} options={options} onRestart={() => restart()} />;
  }
}
