import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', 'xlsx'],
  // El worker de pdfjs (pdf.worker.mjs) se carga con un import dinámico de
  // ruta calculada que el file-tracing de Vercel no detecta; sin esto la
  // función serverless despliega sin el archivo y el parseo de PDFs falla.
  outputFileTracingIncludes: {
    '/api/colillas/parsear': ['./node_modules/pdf-parse/dist/**/*'],
  },
};

export default nextConfig;
