import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MongoClient } from "mongodb";
import "dotenv/config";

async function testSimpleSearch() {
  try {
    console.log("Testing simple vector search...");
    
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const collection = client.db("langchain_demo").collection("nodeEmbeddings");
    
    // First, let's just try a basic similarity search
    const vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }), {
      collection,
      indexName: "default",
      textKey: "text", 
      embeddingKey: "embedding",
    });

    // Try different search methods
    console.log("1. Testing similarity search...");
    try {
      const results1 = await vectorStore.similaritySearch("uncleared transactions", 3);
      console.log(`Similarity search found ${results1.length} results`);
      if (results1.length > 0) {
        console.log("First result:", results1[0].pageContent.substring(0, 100));
      }
    } catch (error) {
      console.log("Similarity search error:", error.message);
    }

    console.log("\n2. Testing with retriever...");
    try {
      const retriever = vectorStore.asRetriever({
        searchType: "similarity",
        k: 3,
      });
      
      const results2 = await retriever.getRelevantDocuments("uncleared transactions");
      console.log(`Retriever found ${results2.length} results`);
      if (results2.length > 0) {
        console.log("First result:", results2[0].pageContent.substring(0, 100));
      }
    } catch (error) {
      console.log("Retriever error:", error.message);
    }
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSimpleSearch();
