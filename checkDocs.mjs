import { MongoClient } from "mongodb";
import "dotenv/config";

async function checkDocuments() {
  try {
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const db = client.db("langchain_demo");
    const collection = db.collection("nodeEmbeddings");
    
    // Get one sample document to see the structure
    const sampleDoc = await collection.findOne({});
    console.log("Sample document structure:");
    console.log(JSON.stringify(sampleDoc, null, 2));
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkDocuments();
