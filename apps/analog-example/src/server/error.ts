import type { NitroErrorHandler } from "nitropack";

const errorHandler: NitroErrorHandler = function (error, event) {
  console.log(error);
  event.node.res.end("[custom error handler] " + error.stack);
};

export default errorHandler;
