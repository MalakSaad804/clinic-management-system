// "Who is doing this request?" - stored per request so Mongoose hooks
// (which do not know about req/res) can still write who made the change.
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

module.exports = {
  run: (store, fn) => storage.run(store, fn),
  get: () => storage.getStore() || {},
};
