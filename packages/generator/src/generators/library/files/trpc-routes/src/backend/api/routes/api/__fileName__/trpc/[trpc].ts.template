import { createTrpcNitroHandler } from '@analogjs/trpc/server';

import { createContext } from '../../../../trpc/context';
import { libRouter } from '../../../../trpc/routers';

// export API handler
export default createTrpcNitroHandler({
  router: libRouter,
  createContext,
});
