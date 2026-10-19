/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Load these packages with Node's native require instead of bundling them
    // (pdf-parse/pdfjs ship dynamic requires + a native canvas that break when
    // webpack-bundled). Externalized packages stay as literal `require()` calls
    // in the build output, so @vercel/nft traces them into the serverless
    // function — without this, `require('pdf-parse')` fails on Vercel at
    // runtime with "Cannot find module".
    serverComponentsExternalPackages: [
      "@prisma/client",
      "prisma",
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
      "tesseract.js",
    ],
    // Belt-and-braces: force-include PDF/OCR runtime assets and Prisma assets in the trace.
    outputFileTracingIncludes: {
      "/api/upload": [
        "./node_modules/pdf-parse/**",
        "./node_modules/pdfjs-dist/**",
        "./node_modules/@napi-rs/**",
        "./node_modules/tesseract.js/**",
        "./node_modules/tesseract.js-core/**",
      ],
      "/api/**": [
        "./prisma/**",
        "./node_modules/.prisma/**",
        "./node_modules/@prisma/**",
      ],
    },
  },
};

module.exports = nextConfig;