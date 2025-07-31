import { StreamingTextResponse, LangChainStream, Message } from 'ai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AIMessage, HumanMessage } from 'langchain/schema';

export const runtime = 'edge';

export async function POST(req: Request) {
  const body = await req.json();
  const currentMessageContent = body.prompt || (body.messages && body.messages[body.messages.length - 1].content);

  const vectorSearch = await fetch("http://localhost:3000/api/vectorSearch", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: currentMessageContent,
  }).then((res) => res.json());

  console.log(`Vector search for "${currentMessageContent}" found ${vectorSearch.length} results`);
  if (vectorSearch.length > 0) {
    console.log(`Top result score: ${vectorSearch[0].metadata?.score}`);
  }

  const TEMPLATE = `You are a very enthusiastic freeCodeCamp.org representative who loves to help people! Given the following sections from the freeCodeCamp.org contributor documentation, answer the question using only that information, outputted in markdown format. 

  Instructions for handling different types of queries:
  1. If the question directly relates to the documentation, provide a comprehensive answer
  2. If the question seems loosely related, try to find connections and provide helpful information
  3. If the question uses informal language or slang (like "rats" meaning problems), interpret it generously and look for relevant troubleshooting or help information
  4. If the question is about general programming concepts, look for related freeCodeCamp information that might be helpful
  5. Only say "Sorry, I don't know how to help with that" if the question is completely unrelated to programming, web development, or freeCodeCamp

  When you find relevant information, always explain how it relates to the user's question, even if the connection isn't obvious.
  
  Context sections:
  ${JSON.stringify(vectorSearch)}

  Question: """
  ${currentMessageContent}
  """
  `;

  // Create messages array if it doesn't exist
  const messages = body.messages || [{ role: 'user', content: currentMessageContent }];
  messages[messages.length - 1].content = TEMPLATE;

  const { stream, handlers } = LangChainStream();

  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
  });

  llm
    .call(
      (messages as Message[]).map(m =>
        m.role == 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content),
      ),
      {},
      [handlers],
    )
    .catch(console.error);

  return new StreamingTextResponse(stream);
}
