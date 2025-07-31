import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import mongoClientPromise from '@/app/lib/mongodb';

export async function POST(req: Request) {
  const client = await mongoClientPromise;
  const dbName = "langchain_demo";
  const collectionName = "nodeEmbeddings";
  const collection = client.db(dbName).collection(collectionName);
  
  const question = await req.text();

  // Create embeddings for the query
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-ada-002',
    stripNewLines: true,
  });
  
  const queryEmbedding = await embeddings.embedQuery(question);
  
  // Use MongoDB's native vector search
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
  
  // Convert to LangChain document format for compatibility
  const documents = results.map((doc: any) => ({
    pageContent: doc.text,
    metadata: { score: doc.score }
  }));
  
  return Response.json(documents);
}