import { MongoClient } from "mongodb";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import "dotenv/config";

// Function to preprocess and expand queries for better search tolerance
function preprocessQuery(query) {
  // Convert to lowercase for consistency
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Add common synonyms and related terms for better matching
  const synonymMap = {
    'rats': ['problems', 'issues', 'bugs', 'errors', 'troubleshooting'],
    'help': ['assistance', 'support', 'guide', 'tutorial'],
    'setup': ['install', 'configure', 'installation', 'configuration'],
    'run': ['execute', 'start', 'launch'],
    'fix': ['solve', 'repair', 'troubleshoot'],
    'error': ['problem', 'issue', 'bug', 'trouble'],
  };
  
  // Check if query contains any keys from synonym map
  let expandedQuery = lowercaseQuery;
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (lowercaseQuery.includes(key)) {
      expandedQuery += ' ' + synonyms.join(' ');
    }
  }
  
  return expandedQuery;
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
      
      // Test with expanded query
      const expandedQuery = preprocessQuery(query);
      console.log(`Expanded query: "${expandedQuery}"`);
      
      const queryEmbedding = await embeddings.embedQuery(expandedQuery);
      
      const pipeline = [
        {
          $vectorSearch: {
            index: "nodeEmbeddings",
            path: "embedding",
            queryVector: queryEmbedding,
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
            score: { $gte: 0.1 }
          }
        }
      ];
      
      const results = await collection.aggregate(pipeline).toArray();
      console.log(`Found ${results.length} results`);
      
      if (results.length > 0) {
        console.log(`Top result (score: ${results[0].score.toFixed(3)}):`);
        console.log(results[0].text.substring(0, 150) + "...");
      } else {
        console.log("No results found with current settings");
      }
    }
    
    await client.close();
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSearchTolerance();
