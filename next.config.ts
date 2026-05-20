import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Permite subir fotos de comprobantes desde el celular (cámaras
      // típicas producen 2–5 MB). 10 MB cubre con margen sin abrir
      // demasiado el límite.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
