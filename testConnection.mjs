import { MongoClient } from "mongodb";
import "dotenv/config";

async function testConnection() {
  try {
    console.log("Testing MongoDB connection...");
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    console.log("Successfully connected to MongoDB Atlas!");
    
    // Test database access
    const db = client.db("langchain_demo");
    const collections = await db.listCollections().toArray();
    console.log("Available collections:", collections.map(c => c.name));
    
    // Check nodeEmbeddings collection specifically
    const nodeEmbeddings = db.collection("nodeEmbeddings");
    const count = await nodeEmbeddings.countDocuments();
    console.log(`Documents in nodeEmbeddings collection: ${count}`);
    
    await client.close();
    console.log("Connection closed.");
  } catch (error) {
    console.error("Connection failed:", error.message);
  }
}

testConnection();
