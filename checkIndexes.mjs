import { MongoClient } from "mongodb";
import "dotenv/config";

async function checkIndexes() {
  try {
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const db = client.db("langchain_demo");
    const collection = db.collection("nodeEmbeddings");
    
    console.log("Checking indexes on nodeEmbeddings collection...");
    const indexes = await collection.listIndexes().toArray();
    
    console.log("Available indexes:");
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. Name: "${index.name}"`);
      console.log(`   Type: ${index.type || 'standard'}`);
      if (index.definition) {
        console.log(`   Definition:`, JSON.stringify(index.definition, null, 2));
      }
      console.log('---');
    });
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkIndexes();
