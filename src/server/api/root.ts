import { scriptsRouter } from "~/server/api/routers/scripts";
import { installedScriptsRouter } from "~/server/api/routers/installedScripts";
import { serversRouter } from "~/server/api/routers/servers";
import { versionRouter } from "~/server/api/routers/version";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  scripts: scriptsRouter,
  installedScripts: installedScriptsRouter,
  servers: serversRouter,
  version: versionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
