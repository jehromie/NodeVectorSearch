import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanMessage, SystemMessage } from "langchain/schema";
import "dotenv/config";

// Function to use OpenAI to correct and expand unclear queries
async function correctQueryWithOpenAI(query) {
  const chatModel = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.3,
    maxTokens: 100,
  });

  try {
    const messages = [
      new SystemMessage(`You are a query correction assistant for a documentation search system. Your job is to:
1. Fix typos and spelling errors
2. Expand abbreviations to full terms
3. Add related keywords that would help find relevant documentation
4. Interpret unclear or incomplete queries

Focus on banking, financial services, web development, and programming topics.

Examples:
- "rat" → "interest rate pricing cost"
- "rats" → "problems issues errors troubleshooting bugs"
- "lowest rat" → "lowest interest rate minimum rate best rate"
- "loa" → "loan mortgage lending"
- "setup" → "setup installation configuration install"

Return only the corrected/expanded query, nothing else.`),
      new HumanMessage(`Correct and expand this query: "${query}"`)
    ];

    const response = await chatModel.call(messages);
    const correctedQuery = response.content.trim();
    console.log(`OpenAI corrected "${query}" → "${correctedQuery}"`);
    return correctedQuery;
  } catch (error) {
    console.error("OpenAI correction failed:", error);
    return query; // Fallback to original query
  }
}

async function testSearchTolerance() {
  try {
    console.log("Testing improved search tolerance...");
    const client = new MongoClient(process.env.MONGODB_ATLAS_URI);
    await client.connect();
    
    const collection = client.db("langchain_demo").collection("nodeEmbeddings");
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-ada-002',
      stripNewLines: true,
    });

    const testQueries = [
      "rats", 
      "rat", 
      "lowest rat", 
      "what is the lowest rat",
      "help me", 
      "setup issues", 
      "problems with installation",
      "fixed rates",
      "interst rates", // typo test
      "morgage", // typo test
      "loa terms" // abbreviation test
    ];
    
    for (const query of testQueries) {
      console.log(`\n=== Testing query: "${query}" ===`);
      
      // Test initial search
      const initialQueryEmbedding = await embeddings.embedQuery(query);
      
      const initialPipeline = [
        {
          $vectorSearch: {
            index: "nodeEmbeddings",
            path: "embedding",
            queryVector: initialQueryEmbedding,
            numCandidates: 200,
            limit: 10
          }
        },
        {
          $project: {
            text: 1,
            score: { $meta: "vectorSearchScore" }
          }
        },
        {
          $match: {
            score: { $gte: 0.2 }
          }
        }
      ];
      
      const initialResults = await collection.aggregate(initialPipeline).toArray();
      console.log(`Initial search found ${initialResults.length} results`);
      
      if (initialResults.length > 0) {
        console.log(`Top result (score: ${initialResults[0].score.toFixed(3)}):`);
        console.log(initialResults[0].text.substring(0, 150) + "...");
      } else {
        console.log("No results with initial search, trying OpenAI correction...");
        
        // Try OpenAI correction
        const correctedQuery = await correctQueryWithOpenAI(query);
        
        if (correctedQuery !== query) {
          const correctedQueryEmbedding = await embeddings.embedQuery(correctedQuery);
          
          const correctedPipeline = [
            {
              $vectorSearch: {
                index: "nodeEmbeddings",
                path: "embedding",
                queryVector: correctedQueryEmbedding,
                numCandidates: 300,
                limit: 15
              }
            },
            {
              $project: {
                text: 1,
                score: { $meta: "vectorSearchScore" }
              }
            },
            {
              $match: {
                score: { $gte: 0.1 }
              }
            }
          ];
          
          const correctedResults = await collection.aggregate(correctedPipeline).toArray();
          console.log(`Corrected search found ${correctedResults.length} results`);
          
          if (correctedResults.length > 0) {
            console.log(`Top corrected result (score: ${correctedResults[0].score.toFixed(3)}):`);
            console.log(correctedResults[0].text.substring(0, 150) + "...");
          } else {
            console.log("No results found even with correction");
          }
        }
      }
    }
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSearchTolerance();
