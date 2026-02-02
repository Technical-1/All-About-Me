import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';
import { searchContext, formatContext } from '../../lib/rag-server';

// Simple in-memory rate limiting
// Note: This resets on server restart. For production, use Redis or similar.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute per IP
const MAX_RATE_LIMIT_ENTRIES = 10000; // Prevent unbounded memory growth

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // Clean up expired entry for this IP if exists
  const existingRecord = rateLimitMap.get(ip);
  if (existingRecord && now > existingRecord.resetTime) {
    rateLimitMap.delete(ip);
  }

  const record = rateLimitMap.get(ip);

  if (!record) {
    // Prevent unbounded memory growth - if map is too large, reject new IPs
    if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
      // Perform cleanup before rejecting
      cleanupExpiredEntries();
      if (rateLimitMap.size >= MAX_RATE_LIMIT_ENTRIES) {
        // Still too many entries, reject to prevent DoS via memory exhaustion
        return { allowed: false, remaining: 0 };
      }
    }
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  // Increment count (not atomic, but acceptable for portfolio site traffic levels)
  record.count = record.count + 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

// Clean up old entries periodically (every 5 minutes to reduce overhead)
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

// This API route must be server-rendered (not static)
export const prerender = false;

// Validation limits
const MAX_MESSAGE_LENGTH = 4000; // ~1000 tokens
const MAX_MESSAGES_COUNT = 20;   // Reasonable conversation length
const MAX_TOTAL_CHARS = 32000;   // Prevent massive context

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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Rate limiting - only trust clientAddress from Astro (server-set)
  // Don't use X-Forwarded-For as it can be spoofed by clients
  const ip = clientAddress || 'unknown';
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a minute and try again.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  try {
    // Parse request body
    const body = await request.json() as ChatRequest;

    // Validate request structure
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate message count
    if (body.messages.length > MAX_MESSAGES_COUNT) {
      return new Response(
        JSON.stringify({ error: `Conversation too long. Maximum ${MAX_MESSAGES_COUNT} messages allowed.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate individual messages and total length
    let totalChars = 0;
    for (const msg of body.messages) {
      // Check message structure
      if (!msg.content || typeof msg.content !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid message format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check message length
      if (msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(
          JSON.stringify({ error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters per message.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check role is valid
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return new Response(
          JSON.stringify({ error: 'Invalid message role' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      totalChars += msg.content.length;
    }

    // Check total conversation length
    if (totalChars > MAX_TOTAL_CHARS) {
      return new Response(
        JSON.stringify({ error: 'Conversation too long. Please start a new chat.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment
    const apiKey = import.meta.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Service temporarily unavailable.' }),
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
        JSON.stringify({ error: 'Unable to process your request. Please try again.' }),
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
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        }
      }
    );

  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific Anthropic API errors
    if (error instanceof Anthropic.APIError) {
      // Log full error server-side for debugging
      console.error('Anthropic API error details:', {
        status: error.status,
        message: error.message,
      });

      // Return generic message to client (don't leak internal details)
      const statusCode = error.status || 500;
      const clientMessage = statusCode === 429
        ? 'Too many requests. Please wait a moment and try again.'
        : statusCode === 401
          ? 'Service temporarily unavailable.'
          : 'Unable to process your request. Please try again.';

      return new Response(
        JSON.stringify({ error: clientMessage }),
        {
          status: statusCode,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle general errors - never expose internal details
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
