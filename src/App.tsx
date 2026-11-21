import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Notices } from "./components/Notices";
import { I18nProvider } from "./lib/i18n";
import { SettingsPanel } from "./components/SettingsPanel";
import { TitleBar, type View } from "./components/TitleBar";
import { useInventory } from "./lib/inventory";
import { useSpeedtest } from "./lib/speedtest";
import { applySettings, loadSettings, saveSettings, type Settings } from "./lib/themes";
import { isTauri, useSensors } from "./lib/useSensors";
import { Dashboard } from "./views/Dashboard";
import { MyPC } from "./views/MyPC";
import { Speedtest } from "./views/Speedtest";

// Parámetros de URL para demos y capturas: ?view=mypc  ?settings  ?autostart (speedtest simulado)
const params = new URLSearchParams(location.search);
const VIEWS: View[] = ["dashboard", "mypc", "speedtest"];
const initialView = (VIEWS.find((v) => v === params.get("view")) ?? "dashboard") as View;
let autostarted = false; // React en desarrollo ejecuta los efectos dos veces

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [settingsOpen, setSettingsOpen] = useState(params.has("settings"));
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const { data, history, error, live } = useSensors();
  const inv = useInventory();
  const speed = useSpeedtest();
  useEffect(() => {
    if (!isTauri && params.has("autostart") && !autostarted) {
      autostarted = true;
      speed.start({ kind: "full", seconds: 10 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeSettings = useCallback((s: Settings) => {
    setSettings(s);
    applySettings(s);
    saveSettings(s);
  }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <I18nProvider lang={settings.lang}>
    <MotionConfig reducedMotion={settings.animations ? "never" : "always"}>
    <div className="app flex h-screen flex-col overflow-hidden">
      <TitleBar live={live} error={error} view={view} onView={setView} onSettings={() => setSettingsOpen(true)} />
      <SettingsPanel open={settingsOpen} onClose={closeSettings} settings={settings} onChange={changeSettings} />

      <main className="flex-1 overflow-y-auto px-5 pb-5">
        {view !== "speedtest" && <Notices data={data} error={error} />}

        <AnimatePresence mode="wait">
          <motion.div key={view}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            {view === "dashboard" && <Dashboard data={data} history={history} />}
            {view === "mypc" && <MyPC {...inv} />}
            {view === "speedtest" && <Speedtest speed={speed} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
    </MotionConfig>
    </I18nProvider>
  );
}
