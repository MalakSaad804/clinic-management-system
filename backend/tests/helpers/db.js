const mongoose = require('mongoose');

let mongod;

// Uses MONGO_URI_TEST when set (CI service container); otherwise starts an in-memory MongoDB.
async function connect() {
  let uri = process.env.MONGO_URI_TEST;
  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('clinic_test');
  }
  await mongoose.connect(uri);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build unique indexes
}

async function clear() {
  // native deleteMany on purpose: Audit blocks deletes through Mongoose
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function close() {
  if (!mongod) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { connect, clear, close };
