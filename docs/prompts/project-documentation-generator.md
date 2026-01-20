# Project Documentation Generator Prompt

Use this prompt in each of your project repositories to generate portfolio documentation files.

---

## The Prompt

Copy and paste this into Claude Code when you're in a project directory:

```
I need you to analyze this project and generate 3 documentation files for my portfolio website. These files will be used to display rich project details and enable AI-powered Q&A about the project.

Please create these 3 files in a `.portfolio/` directory at the project root:

## 1. `.portfolio/architecture.md`

Create a comprehensive architecture document that includes:

### Mermaid Diagram
Generate a Mermaid diagram showing:
- System components and their relationships
- Data flow between components
- External services/APIs used
- Database schemas (if applicable)
- Key modules and their dependencies

Use appropriate Mermaid diagram types:
- `flowchart TD` for system architecture
- `sequenceDiagram` for request flows
- `erDiagram` for database schemas
- `classDiagram` for OOP structures

### Architecture Overview
- High-level system description
- Key architectural decisions and why they were made
- Scalability considerations
- Security measures implemented

## 2. `.portfolio/stack.md`

Create a detailed technology stack document:

### Frontend (if applicable)
- Framework/library and version
- State management approach
- UI component library
- Styling solution
- Build tools

### Backend (if applicable)
- Language and runtime
- Framework
- API design (REST/GraphQL/etc.)
- Authentication method

### Database (if applicable)
- Database type and why chosen
- ORM/query builder
- Schema design philosophy

### Infrastructure
- Hosting/deployment
- CI/CD pipeline
- Monitoring/logging
- Environment management

### Development Tools
- Package manager
- Linting/formatting
- Testing framework
- Version control workflow

### Key Dependencies
List the most important dependencies with brief explanations of why each was chosen.

## 3. `.portfolio/qa.md`

Create a Q&A knowledge base for AI assistants:

### Project Overview
- One-paragraph summary
- Problem it solves
- Target users/audience

### Key Features
Bullet list of main features with brief descriptions.

### Technical Highlights
- Most interesting technical challenges solved
- Innovative approaches used
- Performance optimizations
- Security implementations

### Code Patterns
- Design patterns used and where
- Code organization philosophy
- Naming conventions

### Development Story
- How long did it take to build?
- What was the hardest part?
- What would you do differently?
- Future improvements planned

### FAQ
Common questions someone might ask about this project:
- "How does [feature X] work?"
- "Why did you choose [technology Y]?"
- "How does the app handle [scenario Z]?"

Include 5-10 Q&A pairs specific to this project.

---

## File Format Requirements

- Use proper Markdown formatting
- Include code snippets where helpful (with language tags)
- Keep explanations concise but complete
- Write in first person ("I chose...", "I implemented...")
- Be honest about limitations and areas for improvement

## Before You Start

1. Read through the entire codebase
2. Check package.json/requirements.txt/Cargo.toml for dependencies
3. Look at the README if it exists
4. Understand the project structure
5. Identify the core functionality

Now analyze this project and generate all 3 files.
```

---

## Expected Output Structure

After running the prompt, each repo should have:

```
your-project/
├── .portfolio/
│   ├── architecture.md    # System design & Mermaid diagrams
│   ├── stack.md           # Technology stack details
│   └── qa.md              # AI knowledge base & FAQ
├── src/
├── package.json
└── ...
```

---

## Tips for Best Results

1. **Run in the project root** - Make sure Claude has access to all files
2. **Review and edit** - The generated content is a starting point; personalize it
3. **Add screenshots** - Reference screenshot paths that you'll add manually
4. **Update periodically** - Re-run when major changes are made
5. **Commit the files** - Push to the repo so the sync script can fetch them

---

## Quick Version (For Simple Projects)

If a project is simple, use this shorter prompt:

```
Analyze this project and create a `.portfolio/` directory with:
1. `architecture.md` - Mermaid diagram + system overview
2. `stack.md` - Tech stack with versions and reasons
3. `qa.md` - Project summary, features, and 5 FAQ pairs

Keep it concise but informative for a portfolio showcase.
```
