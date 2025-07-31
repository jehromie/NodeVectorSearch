import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import "dotenv/config";

async function testNativeVectorSearch() {
  try {
    console.log("Testing native MongoDB vector search...");
    
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const collection = client.db("langchain_demo").collection("nodeEmbeddings");
    
    // Create embeddings for the query
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      stripNewLines: true,
    });
    
    const queryText = "uncleared transactions";
    console.log(`Searching for: "${queryText}"`);
    
    const queryEmbedding = await embeddings.embedQuery(queryText);
    console.log("Query embedding created, length:", queryEmbedding.length);
    
    // Use MongoDB's native vector search aggregation
    const pipeline = [
      {
        $vectorSearch: {
          index: "nodeEmbeddings",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 5
        }
      },
      {
        $project: {
          text: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];
    
    const results = await collection.aggregate(pipeline).toArray();
    
    console.log(`Found ${results.length} results:`);
    
    results.forEach((doc, i) => {
      console.log(`\n--- Result ${i + 1} (Score: ${doc.score}) ---`);
      console.log(doc.text.substring(0, 200) + "...");
    });
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testNativeVectorSearch();
