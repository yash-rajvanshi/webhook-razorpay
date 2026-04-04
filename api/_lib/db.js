const { MongoClient } = require('mongodb');
const config = require('./config');

const uri = config.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!config.MONGODB_URI) {
  console.error("Please add your Mongo URI to .env");
}

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

/**
 * Returns the initialized database instance
 * Usage: const db = await getDb();
 */
async function getDb() {
  const connectedClient = await clientPromise;
  // Automatically defaults to the database named inside the connection string
  return connectedClient.db(); 
}

module.exports = {
  clientPromise,
  getDb
};
