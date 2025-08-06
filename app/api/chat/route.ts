import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

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

  const TEMPLATE = `I am an RAG (Retrieval-Augmented Generation) proof of concept.

  Instructions for handling different types of queries:
  1.Always try to provide some useful information if any context is provided, even if the match isn't perfect
  2.Only say "Sorry, I don't know how to help with that" if the question is completely unrelated to what is in the RAG database.

  When you find relevant information, always explain how it relates to the user's question, even if the connection isn't obvious. If the query seems incomplete, acknowledge this and provide the best related information you can find.
  
  Context sections:
  ${JSON.stringify(vectorSearch)}

  Question: """
  ${currentMessageContent}
  """
  `;

  // Create messages array if it doesn't exist
  const messages = body.messages || [{ role: 'user', content: currentMessageContent }];
  messages[messages.length - 1].content = TEMPLATE;

  const result = await streamText({
    model: openai('gpt-3.5-turbo'),
    messages: messages,
    temperature: 0.9, // Add this line to control response creativity
  });

  return result.toTextStreamResponse();
}
