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
          background: "#f7f7f5",
          fontFamily: "serif",
        }}
      >
        {/* Trapp-motivet: tre stigende søyler, siste i gull — samme
            geometri som Trapp-komponenten og app-ikonet, ikke en ny form. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div style={{ width: 34, height: 70, background: "#c3cfdd", borderRadius: 6 }} />
          <div style={{ width: 34, height: 110, background: "#21456e", borderRadius: 6 }} />
          <div style={{ width: 34, height: 150, background: "#a8781c", borderRadius: 6 }} />
        </div>
        <div style={{ marginTop: 36, fontSize: 64, color: "#1c2b33", fontWeight: 600 }}>
          {APP_NAME}
        </div>
        <div style={{ marginTop: 12, fontSize: 28, color: "#5c6b73" }}>
          Forstå brevet. Sjekk gebyrene. Svar riktig.
        </div>
      </div>
    ),
    { ...size },
  );
}
