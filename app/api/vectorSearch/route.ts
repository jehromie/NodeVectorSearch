import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import mongoClientPromise from '@/app/lib/mongodb';

// Function to preprocess and expand queries for better search tolerance
function preprocessQuery(query: string): string {
  // Convert to lowercase for consistency
  const lowercaseQuery = query.toLowerCase().trim();
  
  // Add common synonyms and related terms for better matching
  const synonymMap: { [key: string]: string[] } = {
    'rats': ['problems', 'issues', 'bugs', 'errors', 'troubleshooting'],
    'rat': ['rate', 'rates', 'interest rate', 'pricing', 'cost'],
    'help': ['assistance', 'support', 'guide', 'tutorial'],
    'setup': ['install', 'configure', 'installation', 'configuration'],
    'run': ['execute', 'start', 'launch'],
    'fix': ['solve', 'repair', 'troubleshoot'],
    'error': ['problem', 'issue', 'bug', 'trouble'],
    'lowest': ['minimum', 'cheapest', 'best', 'reduced'],
    'fixed': ['locked', 'stable', 'unchanging'],
    'term': ['period', 'duration', 'length', 'time'],
    'loan': ['mortgage', 'lending', 'borrowing', 'finance'],
    'bank': ['banking', 'financial', 'institution'],
  };
  
  // Fuzzy matching for common typos and abbreviations
  const fuzzyMap: { [key: string]: string } = {
    'rat': 'rate',
    'rats': 'rates',
    'loa': 'loan',
    'interst': 'interest',
    'morgage': 'mortgage',
    'finacial': 'financial',
    'bnak': 'bank',
  };
  
  // Apply fuzzy corrections
  let correctedQuery = lowercaseQuery;
  for (const [typo, correction] of Object.entries(fuzzyMap)) {
    const regex = new RegExp(`\\b${typo}\\b`, 'g');
    correctedQuery = correctedQuery.replace(regex, correction);
  }
  
  // Check if query contains any keys from synonym map
  let expandedQuery = correctedQuery;
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (correctedQuery.includes(key)) {
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
  console.log(`Original query: "${question}"`);
  console.log(`Expanded query: "${expandedQuery}"`);
  
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
  console.log(`Initial search found ${results.length} results`);
  if (results.length > 0) {
    console.log(`Top score: ${results[0].score.toFixed(3)}`);
  }
  
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
    console.log(`Broader search found ${broadResults.length} results`);
    if (broadResults.length > 0) {
      console.log(`Broader search top score: ${broadResults[0].score.toFixed(3)}`);
    }
    finalResults = broadResults.length > results.length ? broadResults : results;
  }
  
  // Convert to LangChain document format for compatibility
  const documents = finalResults.map((doc: any) => ({
    pageContent: doc.text,
    metadata: { score: doc.score }
  }));
  
  return Response.json(documents);
}