import type { NextConfig } from "next";

// Two build targets share this config:
//   - default:               `output: "standalone"` for the Docker image.
//   - NEXT_OUTPUT=export:     fully static export (out/) for GitHub Pages.
//
// For GitHub Pages *project* sites the app is served from a sub-path
// (https://<user>.github.io/<repo>/), so basePath must be set to "/<repo>".
// The deploy workflow passes it via NEXT_PUBLIC_BASE_PATH.
const isExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = isExport
  ? {
      output: "export",
      basePath: basePath || undefined,
      images: { unoptimized: true },
      // Emit each route as a directory with index.html so GitHub Pages serves
      // clean URLs (and refreshes) without a server.
      trailingSlash: true,
    }
  : {
      // Minimal self-contained server bundle for the Docker image.
      output: "standalone",
    };

export default nextConfig;
