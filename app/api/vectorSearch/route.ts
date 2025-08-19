import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import mongoClientPromise from '@/app/lib/mongodb';

// Function to use OpenAI to correct and expand unclear queries
async function correctQueryWithOpenAI(query: string): Promise<string> {
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

    const response = await chatModel.invoke(messages);
    const correctedQuery = typeof response.content === 'string' 
      ? response.content.trim() 
      : String(response.content).trim();
    console.log(`OpenAI corrected "${query}" → "${correctedQuery}"`);
    return correctedQuery;
  } catch (error) {
    console.error("OpenAI correction failed:", error);
    return query; // Fallback to original query
  }
}

export async function POST(req: Request) {
  const client = await mongoClientPromise;
  const dbName = "langchain_demo";
  const collectionName = "nodeEmbeddings";
  const collection = client.db(dbName).collection(collectionName);
  
  const question = await req.text();
  console.log(`Original query: "${question}"`);
  
  // Create embeddings for the query
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-ada-002',
    stripNewLines: true,
  });

  // Try initial search with original query
  const initialQueryEmbedding = await embeddings.embedQuery(question);
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
        score: { $gte: 0.2 } // Higher threshold for initial search
      }
    }
  ];

  const initialResults = await collection.aggregate(initialPipeline).toArray();
  console.log(`Initial search found ${initialResults.length} results`);
  if (initialResults.length > 0) {
    console.log(`Top score: ${initialResults[0].score.toFixed(3)}`);
  }

  let finalResults = initialResults;

  // If initial search doesn't yield good results, use OpenAI to correct/expand the query
  if (initialResults.length < 2 || (initialResults.length > 0 && initialResults[0].score < 0.4)) {
    console.log("Initial search results poor, using OpenAI to correct query...");
    
    const correctedQuery = await correctQueryWithOpenAI(question);
    
    if (correctedQuery !== question) {
      // Search again with corrected query
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
            score: { $gte: 0.1 } // More lenient threshold for corrected search
          }
        }
      ];
      
      const correctedResults = await collection.aggregate(correctedPipeline).toArray();
      console.log(`Corrected search found ${correctedResults.length} results`);
      if (correctedResults.length > 0) {
        console.log(`Corrected search top score: ${correctedResults[0].score.toFixed(3)}`);
      }
      
      // Use corrected results if they're better
      if (correctedResults.length > initialResults.length || 
          (correctedResults.length > 0 && initialResults.length > 0 && 
           correctedResults[0].score > initialResults[0].score)) {
        finalResults = correctedResults;
      }
    }
  }
  
  // Convert to LangChain document format for compatibility
  const documents = finalResults.map((doc: any) => ({
    pageContent: doc.text,
    metadata: { score: doc.score }
  }));
  
  return new Response(JSON.stringify(documents), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}