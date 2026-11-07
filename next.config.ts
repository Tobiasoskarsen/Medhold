import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Standard er 1 MB. Brevlesingen sender opptil to komprimerte bilder eller
      // én PDF, begrenset av lib/brevfil.ts til 3,4 MB base64. Må ligge over den
      // grensen og under Vercels 4,5 MB per forespørsel.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
