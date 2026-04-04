import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export default function UpdateChecker() {
  const [available, setAvailable] = useState(false);
  const [version, setVersion]     = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function checkForUpdate() {
      try {
        const update = await check();
        if (update?.available) {
          setVersion(update.version ?? null);
          setAvailable(true);
        }
      } catch (e) {
        console.log("Update check skipped:", e);
      }
    }
    checkForUpdate();
  }, []);

  async function handleUpdate() {
    setDownloading(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch (e) {
      console.error("Update failed:", e);
      setDownloading(false);
    }
  }

  if (!available) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        padding: "16px 20px",
        width: "300px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "9px",
          background: "rgba(29,158,117,0.10)", border: "1px solid rgba(29,158,117,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#1A1D1B" }}>
            Aggiornamento disponibile
          </div>
          {version && (
            <div style={{ fontSize: "11px", color: "#8A9490", marginTop: "1px" }}>
              Versione {version}
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "#4A5250", margin: 0, lineHeight: 1.5 }}>
        È disponibile una nuova versione di HACCPrint. L'aggiornamento è automatico e richiede solo qualche secondo.
      </p>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => setAvailable(false)}
          disabled={downloading}
          style={{
            flex: 1, padding: "8px", borderRadius: "8px",
            border: "1px solid rgba(0,0,0,0.10)", background: "transparent",
            fontSize: "12px", fontWeight: 500, color: "#4A5250",
            cursor: "pointer",
          }}
        >
          Dopo
        </button>
        <button
          onClick={handleUpdate}
          disabled={downloading}
          style={{
            flex: 2, padding: "8px", borderRadius: "8px",
            border: "none", background: "#1D9E75",
            fontSize: "12px", fontWeight: 600, color: "white",
            cursor: downloading ? "not-allowed" : "pointer",
            opacity: downloading ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}
        >
          {downloading ? (
            <>
              <div style={{
                width: "11px", height: "11px", borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "white",
                animation: "spin 0.7s linear infinite",
              }} />
              Installazione…
            </>
          ) : (
            "Aggiorna ora"
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}