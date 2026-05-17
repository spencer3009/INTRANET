// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer, // Only enable during dev server
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Silence source-map-loader ENOENT for missing .mjs source maps in
      // node_modules (e.g. JSZip → pako resolution where the top-level
      // pako@1 lacks the .esm.mjs file that the resolver tries). Source
      // maps from node_modules are not needed for app debugging.
      if (Array.isArray(webpackConfig.module?.rules)) {
        for (const rule of webpackConfig.module.rules) {
          if (!rule.oneOf) continue;
          for (const sub of rule.oneOf) {
            if (sub.loader && String(sub.loader).includes("source-map-loader")) {
              sub.exclude = Array.isArray(sub.exclude)
                ? [...sub.exclude, /node_modules/]
                : [/node_modules/];
            }
          }
        }
      }
      // Also ignore the specific ENOENT warnings at the top-level rules array
      if (Array.isArray(webpackConfig.module?.rules)) {
        webpackConfig.module.rules.forEach((rule) => {
          if (rule.enforce === "pre" && Array.isArray(rule.use)) {
            rule.use.forEach((u) => {
              if (u.loader && String(u.loader).includes("source-map-loader")) {
                rule.exclude = /node_modules/;
              }
            });
          } else if (rule.enforce === "pre" && rule.loader && String(rule.loader).includes("source-map-loader")) {
            rule.exclude = /node_modules/;
          }
        });
      }
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map.*pako/,
        /ENOENT.*pako/,
      ];

      // Force `pako` to always resolve to the top-level CJS entry. fast-png
      // (transitive dep of jspdf) declares pako@^2 with `module` →
      // `dist/pako.esm.mjs`; jszip declares pako@^1 (no module field). Yarn
      // hoists pako@1 to top-level which lacks pako.esm.mjs, breaking webpack
      // ESM resolution when fast-png imports `pako`. Aliasing both to the
      // top-level v1 keeps the API stable (inflate/Inflate are present in v1)
      // and matches what JSZip expects.
      webpackConfig.resolve = {
        ...(webpackConfig.resolve || {}),
        alias: {
          ...(webpackConfig.resolve?.alias || {}),
          'pako$': path.resolve(__dirname, 'node_modules/pako/index.js'),
        },
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
