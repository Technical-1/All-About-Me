import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { searchContext, formatContext } from '../../lib/rag-server';

// This API route must be server-rendered (not static)
export const prerender = false;

const SYSTEM_PROMPT = `You are a helpful assistant for Jacob Kanfer's portfolio website. Your role is to help visitors learn about Jacob's background, projects, skills, and experiences.

## Guidelines

- Use the retrieved documentation to provide accurate, specific answers about Jacob's work
- Always speak in third person ("Jacob built...", "He developed...", "His experience includes...")
- Be friendly, professional, and concise
- If the retrieved context doesn't contain relevant information, say so honestly rather than making things up
- When discussing technical projects, highlight the technologies used and the problems solved
- Encourage visitors to explore the portfolio, read blog posts, or reach out via the contact page

## Topics You Can Discuss

- **Projects**: Jacob's open source and personal projects, their architecture, technologies, and purpose
- **Skills**: Programming languages, frameworks, tools, and technologies Jacob is proficient in
- **Education**: Academic background and relevant coursework
- **Work Experience**: Professional experience, internships, and roles
- **Leadership**: Leadership positions, community involvement, and extracurricular activities
- **Blog**: Topics Jacob has written about and his technical interests

## Response Style

- Keep responses focused and relevant to what was asked
- Use markdown formatting when helpful (lists, code blocks, bold text)
- Provide specific examples from the documentation when available
- If asked about something outside Jacob's portfolio, politely redirect to relevant topics`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json() as ChatRequest;

    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get API key from environment
    const apiKey = import.meta.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Extract the last user message for RAG search
    const lastUserMessage = [...body.messages]
      .reverse()
      .find(msg => msg.role === 'user');

    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: 'No user message found in conversation' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Perform RAG search to get relevant context
    const searchResults = await searchContext(lastUserMessage.content);
    const contextString = formatContext(searchResults);

    // Build the system prompt with retrieved context
    const systemPromptWithContext = SYSTEM_PROMPT + contextString;

    // Create Anthropic client and make API call
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPromptWithContext,
      messages: body.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    // Extract the assistant's response
    const assistantMessage = response.content[0];

    if (assistantMessage.type !== 'text') {
      return new Response(
        JSON.stringify({ error: 'Unexpected response format from AI' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return successful response
    return new Response(
      JSON.stringify({
        message: {
          role: 'assistant',
          content: assistantMessage.text,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific Anthropic API errors
    if (error instanceof Anthropic.APIError) {
      return new Response(
        JSON.stringify({
          error: 'AI service error',
          details: error.message
        }),
        {
          status: error.status || 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle general errors
    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
