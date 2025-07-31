import { MongoDBAtlasVectorSearch } from "langchain/vectorstores/mongodb_atlas";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { MongoClient } from "mongodb";
import "dotenv/config";

async function testVectorSearch() {
  try {
    console.log("Testing vector search...");
    
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const collection = client.db("langchain_demo").collection("nodeEmbeddings");
    
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

    const retriever = vectorStore.asRetriever({
      searchType: "mmr",
      searchKwargs: {
        fetchK: 20,
        lambda: 0.1,
      },
    });
    
    const question = "what are uncleared transactions";
    console.log(`Searching for: "${question}"`);
    
    const results = await retriever.getRelevantDocuments(question);
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

testVectorSearch();
