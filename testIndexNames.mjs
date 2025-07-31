import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MongoClient } from "mongodb";
import "dotenv/config";

async function testDifferentIndexNames() {
  const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
  await client.connect();
  
  const collection = client.db("langchain_demo").collection("nodeEmbeddings");
  
  // Try different common index names
  const indexNames = ["default", "vector_index", "nodeEmbeddings", "embedding_index"];
  
  for (const indexName of indexNames) {
    try {
      console.log(`\nTesting with index name: "${indexName}"`);
      
      const vectorStore = new MongoDBAtlasVectorSearch(
        new OpenAIEmbeddings({
          modelName: 'text-embedding-ada-002',
          stripNewLines: true,
        }), {
        collection,
        indexName: indexName,
        textKey: "text", 
        embeddingKey: "embedding",
      });

      const results = await vectorStore.similaritySearch("uncleared transactions", 2);
      
      if (results.length > 0) {
        console.log(`✅ SUCCESS! Found ${results.length} results with index "${indexName}"`);
        console.log("First result:", results[0].pageContent.substring(0, 150) + "...");
        await client.close();
        return;
      } else {
        console.log(`❌ No results with index "${indexName}"`);
      }
    } catch (error) {
      console.log(`❌ Error with index "${indexName}":`, error.message);
    }
  }
  
  await client.close();
  console.log("\n❌ None of the index names worked");
}

testDifferentIndexNames();
