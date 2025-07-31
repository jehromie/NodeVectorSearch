import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MongoClient } from "mongodb";
import "dotenv/config";

async function testWithCorrectIndex() {
  try {
    console.log('Testing with correct index name "nodeEmbeddings"...');
    
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const collection = client.db("langchain_demo").collection("nodeEmbeddings");
    
    const vectorStore = new MongoDBAtlasVectorSearch(
      new OpenAIEmbeddings({
        modelName: 'text-embedding-ada-002',
        stripNewLines: true,
      }), {
      collection,
      indexName: "nodeEmbeddings",
      textKey: "text", 
      embeddingKey: "embedding",
    });

    console.log("Testing similarity search...");
    const results = await vectorStore.similaritySearch("uncleared transactions", 3);
    
    console.log(`Found ${results.length} results:`);
    
    results.forEach((doc, i) => {
      console.log(`\n--- Result ${i + 1} ---`);
      console.log(doc.pageContent.substring(0, 200) + "...");
    });
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testWithCorrectIndex();
