import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { env } from "~/env.js";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";
import logger from "../../../../server/logging/logger";
import { requireApiAuth } from "~/lib/api-auth";

const handler = (req: NextRequest) => {
  const authError = requireApiAuth(req);
  if (authError) {
    return authError;
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      env.NODE_ENV === "development"
        ? ({ path, error }) => {
          logger.error("trpc_error", { path: path ?? "<no-path>" }, error);
        }
        : undefined,
  });
};

export { handler as GET, handler as POST };
