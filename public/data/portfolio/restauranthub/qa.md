# Project Q&A Knowledge Base

## Overview

Tela Restaurant's website is a full-stack React application I built for a Honduran restaurant in Gainesville, FL. It serves as the restaurant's primary digital presence — customers can browse the menu, request catering, contact the restaurant, and place online orders via Toast Tab. The admin panel lets restaurant staff manage inquiries and menu items through a protected dashboard backed by Supabase.

## Key Features

- **Interactive Menu**: Customers can search, filter by dietary restrictions (vegetarian, vegan, gluten-free, spicy), browse by category, and expand items for full details including ingredients, allergens, and prep time — all data-driven from Supabase
- **Catering Wizard**: A 3-step guided flow (service selection → menu customization → event details) with real-time cost estimation and a sticky summary sidebar
- **Admin Dashboard**: Protected panel for managing contact inquiries with search, status/priority filters, bulk actions, response composer, and data export
- **Contact System**: Modal-based contact form that persists inquiries to Supabase and triggers email notifications to the restaurant via a Supabase Edge Function + Resend API
- **Brand Storytelling**: "Our Story" page with a timeline of the founders' journey from Honduras to Gainesville, their values, and signature dishes

## Technical Highlights

### Centralized Data Layer with SupabaseContext
I built a single React Context that wraps all Supabase operations — auth, menu queries, catering submissions, contact inquiries, and company settings. Every page consumes this context rather than initializing its own Supabase calls. This keeps the codebase DRY and ensures consistent error handling through a shared `handleApiError` utility.

### Row-Level Security as the Authorization Layer
Rather than building middleware auth, I implemented Postgres RLS policies on every table. Public users can read active menu items and company settings without authentication, while admin operations require the `is_admin()` SQL function to verify the user exists in the `admin_users` table. This means security is enforced at the database level regardless of what the frontend does.

### Custom Brand Design System
The TailwindCSS config encodes the full Tela brand: forest green primary, gold accents, warm off-white backgrounds, Playfair Display headings, and custom warm-toned shadows. This creates a consistent, premium feel across all pages without relying on a component library.

## Development Story

- **Hardest Part**: Designing the catering wizard to handle the multi-step flow with interdependent state (service selection affects menu options, which affect pricing) while keeping the UI intuitive on mobile
- **Lessons Learned**: Supabase RLS is extremely powerful for this kind of app — the public/admin split maps perfectly to RLS policies, and it eliminated a whole class of security concerns
- **Future Plans**: Connect the catering request form to actually submit to Supabase (currently simulated), add menu management CRUD in the admin panel, and integrate Instagram API for the live feed section

## Frequently Asked Questions

### How does the menu system work?
Menu data is stored in two Supabase tables: `menu_categories` (with name, slug, icon, sort order) and `menu_items` (with name, price, description, dietary info, ingredients, allergens). The `MenuPage` component fetches both via `SupabaseContext`, then applies client-side filtering by category, search query, and dietary tags. Items expand inline to show full details.

### Why Supabase instead of a custom backend?
Supabase provides everything this project needs out of the box — PostgreSQL with RLS, built-in auth, edge functions for serverless logic, and a generous free tier. Building a custom Express/Node backend would have added deployment complexity without providing additional value for this use case.

### How does the admin authentication work?
Admins sign in with email/password via Supabase Auth. After authentication, `SupabaseContext.checkAdminStatus()` queries the `admin_users` table to verify the authenticated user has an active admin record. The `AuthenticationGuard` component wraps protected routes and redirects non-admins. All admin API calls are additionally protected by RLS policies at the database level.

### How are contact form emails sent?
When a user submits the contact form, the data is inserted into the `contact_inquiries` table. A Supabase Edge Function (`send-contact-email`) receives the form data, formats it into HTML/text email content, and sends it to the restaurant via the Resend API. The edge function runs server-side on Deno, keeping the Resend API key secure.

### Why Toast Tab for ordering instead of building it in?
Toast Tab is the restaurant's existing POS system, so integrating with their hosted ordering page ensures orders flow directly into their kitchen workflow. Building custom ordering would mean duplicating POS functionality, handling payments, and maintaining order state — all problems Toast Tab already solves.

### What was the most challenging part?
The catering page's multi-step wizard was the most complex feature. Each step depends on the previous one (you can't select menu items without a service, can't submit without menu items), and the sidebar needs to show a live summary with cost estimates. Managing this interdependent state while keeping the UI responsive on mobile required careful component decomposition.

### What would I improve?
I'd add real-time admin notifications when new inquiries arrive (Supabase Realtime subscriptions), build out the menu management admin page for full CRUD, connect the Instagram feed to the actual API instead of static content, and add image upload capability for menu items via Supabase Storage.
