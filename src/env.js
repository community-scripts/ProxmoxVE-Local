import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
   
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Repository Configuration
    REPO_URL: z.string().url().optional(),
   
    REPO_BRANCH: z.string().default("main"),
    SCRIPTS_DIRECTORY: z.string().default("scripts"),
    JSON_FOLDER: z.string().default("json"),
    ALLOWED_SCRIPT_EXTENSIONS: z.string().default(".sh,.py,.js,.ts,.bash"),
    // Security
    MAX_SCRIPT_EXECUTION_TIME: z.string().default("300000"), // 5 minutes in ms
    ALLOWED_SCRIPT_PATHS: z.string().default("scripts/"),
    // WebSocket Configuration
    WEBSOCKET_PORT: z.string().default("3001"),
    // GitHub Configuration
    GITHUB_TOKEN: z.string().optional(),
    // Authentication Configuration
    AUTH_USERNAME: z.string().optional(),
    AUTH_PASSWORD_HASH: z.string().optional(),
    AUTH_ENABLED: z.string().optional(),
    JWT_SECRET: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    // Repository Configuration
    REPO_URL: process.env.REPO_URL,
   
    REPO_BRANCH: process.env.REPO_BRANCH,
    SCRIPTS_DIRECTORY: process.env.SCRIPTS_DIRECTORY,
    JSON_FOLDER: process.env.JSON_FOLDER,
    ALLOWED_SCRIPT_EXTENSIONS: process.env.ALLOWED_SCRIPT_EXTENSIONS,
    // Security
    MAX_SCRIPT_EXECUTION_TIME: process.env.MAX_SCRIPT_EXECUTION_TIME,
    ALLOWED_SCRIPT_PATHS: process.env.ALLOWED_SCRIPT_PATHS,
    // WebSocket Configuration
    WEBSOCKET_PORT: process.env.WEBSOCKET_PORT,
    // GitHub Configuration
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    // Authentication Configuration
    AUTH_USERNAME: process.env.AUTH_USERNAME,
    AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
    AUTH_ENABLED: process.env.AUTH_ENABLED,
    JWT_SECRET: process.env.JWT_SECRET,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
