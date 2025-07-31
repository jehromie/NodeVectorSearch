import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import mongoClientPromise from '@/app/lib/mongodb';

// Function to preprocess and expand queries for better search tolerance
function preprocessQuery(query: string): string {
  // Convert to lowercase for consistency
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Add common synonyms and related terms for better matching
  const synonymMap: { [key: string]: string[] } = {
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

export async function POST(req: Request) {
  const client = await mongoClientPromise;
  const dbName = "langchain_demo";
  const collectionName = "nodeEmbeddings";
  const collection = client.db(dbName).collection(collectionName);
  
  const question = await req.text();
  
  // Preprocess and expand the query for better tolerance
  const expandedQuery = preprocessQuery(question);
  
  // Create embeddings for the query
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-ada-002',
    stripNewLines: true,
  });
  
  const queryEmbedding = await embeddings.embedQuery(expandedQuery);  // Use MongoDB's native vector search with improved tolerance
  const pipeline = [
    {
      $vectorSearch: {
        index: "nodeEmbeddings",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 200, // Increased for broader search
        limit: 10 // More results for better context
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
        score: { $gte: 0.1 } // Filter out very low relevance results
      }
    }
  ];
  
  const results = await collection.aggregate(pipeline).toArray();
  
  // If we don't get good results, try a broader search
  let finalResults = results;
  if (results.length < 3 || (results.length > 0 && results[0].score < 0.3)) {
    console.log("Trying broader search with original query...");
    const broadPipeline = [
      {
        $vectorSearch: {
          index: "nodeEmbeddings",
          path: "embedding",
          queryVector: await embeddings.embedQuery(question), // Use original query
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
          score: { $gte: 0.05 } // Even more lenient threshold
        }
      }
    ];
    
    const broadResults = await collection.aggregate(broadPipeline).toArray();
    finalResults = broadResults.length > results.length ? broadResults : results;
  }
  
  // Convert to LangChain document format for compatibility
  const documents = finalResults.map((doc: any) => ({
    pageContent: doc.text,
    metadata: { score: doc.score }
  }));
  
  return Response.json(documents);
}