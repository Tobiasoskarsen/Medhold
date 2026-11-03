import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#f3f0e9",
          fontFamily: "sans-serif",
        }}
      >
        {/* Trapp-motivet: tre stigende søyler, siste i gull — samme
            geometri som Trapp-komponenten og app-ikonet, ikke en ny form. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div style={{ width: 34, height: 70, background: "#c9ead9", borderRadius: 6 }} />
          <div style={{ width: 34, height: 110, background: "#103c38", borderRadius: 6 }} />
          <div style={{ width: 34, height: 150, background: "#86601a", borderRadius: 6 }} />
        </div>
        <div style={{ marginTop: 36, fontSize: 64, color: "#121614", fontWeight: 800, letterSpacing: -2 }}>
          {APP_NAME}
        </div>
        <div style={{ marginTop: 12, fontSize: 28, color: "#64675f" }}>
          Forstå brevet. Sjekk gebyrene. Svar riktig.
        </div>
      </div>
    ),
    { ...size },
  );
}
