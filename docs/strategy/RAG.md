# RAG — Retrieval-Augmented Generation

Reference document for implementing RAG across NovaWealth products.

---

## What RAG Is

RAG = retrieval + generation:

1. A user sends a query.
2. A **retriever** searches your knowledge base (KB) for relevant passages using semantic search (embeddings) and usually some keyword/BM25 signal.
3. You stuff the retrieved context plus the original query into an **augmented prompt** and send that to the LLM.
4. The LLM writes an answer that is (ideally) **grounded** in those retrieved passages.

You can think of this as giving your LLM a live private "library" instead of retraining it every time your data changes.

For your use case (multiple fintech + language learning tools), that "library" might be:

- Product docs and FAQs
- Internal analytics/explanations
- Regulatory content, investor education material
- User-specific portfolios or notes

---

## Why Use RAG: Benefits

### 1. Fresh, domain-specific knowledge

RAG lets you inject company- or app-specific knowledge (proprietary docs, user data) that is not in the model's training set.

You just update the KB; you don't need to retrain or fine‑tune the base model when content changes.

This is ideal for:
- Financial product docs that update frequently
- Localization / language learning content (new lessons, glossaries)
- Per-user data like portfolios or transaction histories

### 2. Control, safety, and explainability

- You control exactly which sources the assistant can see (e.g., only your docs + specific APIs), which tightens security and reduces off-topic hallucinations.
- You can show **citations** or "sources used" by including retrieved snippets alongside the answer.
- You can enforce **access control** at retrieval time (document- or row-level ACLs before content ever hits the LLM).

### 3. Cost and latency vs fine-tuning

- For many tasks, RAG gives better cost/performance than training/fine‑tuning large models, especially when the "knowledge" is big but behavior is simple (QA, summarization, search).
- You pay inference for one general LLM + vector search instead of training and hosting multiple domain‑specific LLMs.

---

## Downsides and Constraints

### 1. Hallucinations are reduced, not eliminated

Models still can hallucinate even with strong retrieval, especially when retrieved documents are irrelevant, incomplete, or conflicting.

Embedding-based methods that try to detect hallucinations by semantic similarity have fundamental limits; they can miss real hallucinations and misclassify correct answers.

**Mitigation (we'll wire this into the design later):**
- Strong retrieval (chunking, hybrid search, reranking)
- System prompts that force the model to say "I don't know" when context is missing
- Optional answer verification step (LLM-as-judge comparing answer to sources)

### 2. Retrieval quality is the bottleneck

If retrieval is bad—wrong docs, poor chunking, low recall—no amount of clever prompting will save you.

You need to tune: chunk size, overlap, embedding model, vector index, hybrid search parameters, and reranker.

### 3. Latency and complexity

- RAG introduces more moving parts: ingestion pipeline, embeddings, vector DB, retriever, LLM, monitoring.
- Each user query now hits at least a vector index plus the LLM; with reranking or multi-step flows you can add 100–400 ms or more.
- Scaling for high QPS requires engineering around caching, batching, and index sharding.

### 4. Operational work

- You must keep embeddings, indexes, and permissions in sync with the underlying data sources.
- You need observability: query traces, retrieval stats, answer quality metrics, etc.
- Given your engineering level, this is manageable, but you want to design the pipeline cleanly from day one.

---

## RAG Architecture Overview

At a high level, you'll implement two flows: **offline ingestion** and **online query**.

### A. Ingestion / indexing flow

1. **Source connectors:** Pull data from docs, DBs, APIs, etc.
2. **Preprocessing:** Clean, normalize, convert to text (HTML → markdown, PDF → text, etc.).
3. **Chunking:** Split into semantically coherent chunks (e.g., ~300–800 tokens) with overlap.
4. **Embedding:** Encode each chunk with an embedding model into a vector.
5. **Store:**
   - Vector DB for embeddings + metadata (type, tags, ACLs, timestamps).
   - Optionally a separate store (SQL, object storage) for raw full text.

### B. Query / answer flow

1. User query arrives.
2. Preprocess/normalize query (LLM rewrite or template).
3. Retrieve top‑k candidate chunks (semantic/hybrid search).
4. Optional rerank/expand to get best subset.
5. Build an **augmented prompt** with:
   - System instructions
   - User question
   - Retrieved context
6. Call LLM to generate answer.
7. (Optional) Verification / post-processing:
   - LLM judge vs sources
   - Citation formatting or snippet highlighting
   - Caching

---

## Detailed Step‑by‑Step: Building a Practical RAG

Below is an implementation you can actually plug into your stack. Assumes:
- You're using an LLM API (e.g., OpenAI, Anthropic, etc.).
- Vector DB: PostgreSQL + pgvector (Supabase), Qdrant, Pinecone, or Weaviate.
- Services wired together with TypeScript/Node or Python.

### 1. Define the concrete use cases

Before touching infra, lock down what problems you want RAG to solve in your software. Typical high‑ROI patterns:

- **"Explain this portfolio / trade / position"** — QA over positions, holdings, and notes.
- **Product and in‑app support** — QA over internal docs and FAQs.
- **Language learning: "Explain this phrase / grammar pattern"** — grounded in course content and examples.

For each use case, decide:
- **Input format:** free‑form question, or structured (e.g., endpoint with `portfolioId` + question).
- **Required data sources.**
- **Latency budget** (e.g., < 1.5 s P95).
- **Response style** (strictly grounded vs more generative, level of creativity).

This guides chunk size, search configuration, and whether you need reranking or multi‑step workflows.

### 2. Ingestion pipeline

#### 2.1 Data modeling and metadata

For each document chunk, keep:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `text` | Chunk string |
| `source_type` | doc, FAQ, transaction, position, lesson, etc. |
| `source_id` | File ID, DB primary key |
| `section_path` | e.g., "Options / Margin / Requirements" |
| `created_at`, `updated_at` | Timestamps |
| `user_id` or `org_id` | For multi‑tenant/private data |
| Other filters | Language, region, product, difficulty level, etc. |

Metadata is critical for:
- Filtering at retrieval time (user scoping, language, recency).
- Analytics and debugging.

#### 2.2 Chunking strategy

Research shows chunking is one of the most impactful decisions.

**Guidelines:**
- Target **~200–500 tokens per chunk** for most QA; go up to ~800 if context needs more continuity.
- Use **semantic boundaries** when possible:
  - Split by headings, paragraphs, bullets.
  - Avoid splitting mid‑sentence or mid‑formula.
- Add **overlap** (e.g., 10–20% overlap between adjacent chunks) to preserve context across boundaries.

**Examples:**
- **Docs/FAQs:** break by headings and subheadings, then chunk paragraphs with overlap.
- **Code or formulas:** chunk by logical units (function, theorem) rather than fixed size.
- **Transactions/portfolios:** chunk by time windows or logical group (e.g., "positions as of date X").

### 3. Embedding storage

#### 3.1 Choosing an embedding model

Factors:
- Quality vs cost vs latency.
- Multilingual support if you're doing language learning.
- Token limits (for long queries) and throughput.

Research and practitioner guides recommend modern embedding models tuned for retrieval; examples include proprietary offerings and open-source models like Instructor or GTE-based models.

You can start with:
- A strong general-purpose embedding model optimized for semantic search.
- If needed, later specialize (e.g., finance‑tuned embeddings or multilingual variants).

#### 3.2 Vector DB and index

**Vector DB choices (all viable with your stack):**
- **PostgreSQL + pgvector:** good if you already use Postgres and want one DB.
- **Dedicated vector DB** (Pinecone, Qdrant, Weaviate, Milvus, etc.).

**Index choices:**
- HNSW, IVF, or similar approximate nearest neighbor for speed on larger corpora.
- Use **filters on metadata** (e.g., `user_id = X`, `language = 'en'`).
- Also store original text and metadata; many DBs allow this inline, or you can store an ID and keep full text in another store.

### 4. Retrieval pipeline

This is what runs per request.

#### 4.1 Query preprocessing

Techniques that help:
- **Query rewriting** with the LLM itself: turn conversational or underspecified questions into search‑friendly queries while preserving meaning (e.g., expand "this trade" into "explain why we bought XYZ at date X with size Y").
- **Normalization:** lowercasing, stripping stopwords rarely matters for embeddings but may matter for keyword/BM25 channels.

#### 4.2 Hybrid search

Pure embeddings can fail on names, numbers, and rare tokens; hybrid search combines semantic similarity with lexical/keyword search.

**Typical pattern:**
1. Run **semantic search** (embedding k₁, e.g., 50).
2. Run **BM25 / inverted index search** (k₂, e.g., 50).
3. Merge and rerank by weighted score or learn a combiner.

For your finance tooling:
- Numbers (tickers, account IDs, dollar amounts) often benefit from **lexical match**.
- Natural language explanation phrases benefit from **semantic search**.

#### 4.3 Reranking

Even with good retrieval, top‑k semantic results are often noisy.

- Use a **cross‑encoder or reranker model** that takes `(query, chunk)` and outputs a relevance score.
- Feed top ~50 from the initial retrieval into reranker, then pick top ~5–10 to send to LLM.
- This typically boosts answer quality more than just increasing k.

### 5. Prompting and generation

#### 5.1 System prompt design

Define clear constraints:
- *"You are a finance assistant that answers only from the given context. If the answer is not in the context, say you don't know."*
- *"Quote or reference specific passages from the context when explaining recommendations."*

Research and best-practice guides emphasize explicitly instructing the model not to fabricate beyond retrieved context to reduce hallucinations.

#### 5.2 Context packaging

Common pattern:

```
System message with role + rules.

Context document 1: [title, section]
[text]

Context document 2: [title, section]
[text]

… repeated for up to N docs

User question: …

Instructions: Answer only using the context above…
```

Watch **context window limits**: the more you stuff, the less room you have for the question and reasoning.

**Guidelines:**
- Limit context tokens (e.g., 2–4k tokens).
- Include document titles/headings; they help the LLM understand structure.
- Put the most relevant, highest‑ranked chunks first.

#### 5.3 Multiple calls and tools

For more advanced flows:
1. **First call:** parse query and determine retrieval plan (which index/data source).
2. **Second call:** after retrieval, generate answer.
3. **Optional:** third call for verification.

For workflows like portfolio explanation, you might mix RAG with tools:
- Tool call to fetch structured portfolio data.
- RAG over knowledge base to explain metrics, risk, etc.
- Example: *"Why is my risk score higher this month?"* → tool fetches portfolio stats, RAG explains based on a KB of risk explanations.

### 6. Guardrails and hallucination mitigation

Even with good retrieval, you should assume some hallucinations.

**Techniques from recent work:**

**Strict instructions to admit ignorance**
> System prompt: *If the answer is not clearly stated in the context, reply "Not enough information".*

**Answer–source consistency check (LLM‑as‑judge)**

After generating an answer, call a smaller or same model with: *"Given this question, answer, and sources, is the answer fully supported by the sources?"*

If unsupported, either:
- Ask it to revise the answer, or
- Return a "cannot answer from available data" message.

**Citation requirement**

Force the answer to include citations that map to retrieved chunks; this encourages grounding.

**Thresholding on retrieval quality**

If retrieval scores are too low or no chunks are returned, short‑circuit and say you have no data.

### 7. Evaluation and metrics

Evaluation is where RAG goes from "demo" to "production system."

#### 7.1 Data for evaluation

- Log real user queries and anonymized answers.
- Label a sample set manually or semi‑automatically with:
  - Relevance of retrieved docs
  - Answer correctness
  - Grounding (does it match the sources?)
- **Synthetic datasets:** Use an LLM to generate synthetic Q&A pairs from your corpus to create evaluation sets.

#### 7.2 Metrics

| Metric | What it measures |
|--------|-----------------|
| **Retrieval recall@k** | Does the gold answer's source appear in top‑k? |
| **Answer correctness** | Helpfulness (human or LLM‑based scoring) |
| **Grounding score** | Proportion of answers fully supported by retrieved text |
| **Latency (P50, P95)** | Response time |
| **Cost per query** | Token + compute costs |

Use these to tune:
- Chunking strategy
- Embedding model
- Hybrid search weights
- Reranker choice and k
- Prompting template

### 8. Scalability and reliability

Recent best‑practice guides emphasize treating RAG as a distributed system, not just a model call.

**Key patterns:**

- **Redundancy and failover:** multiple vector DB nodes, load balancers, fallback to cached answers or simpler search when vector search fails.
- **Caching:**
  - Query-level cache for popular questions.
  - Embedding cache (don't re‑embed same text).
- **Monitoring:**
  - Application metrics: answer rate, error rate, timeouts.
  - Retrieval metrics: queries per second, latency, recall proxies, hit ratios.
  - Model metrics: token usage, error types.
- **Data drift:**
  - Periodic re‑embeddings when content changes or you upgrade embedding models.
  - Track performance before/after model or index changes.

---

## Putting It All Together for Your Apps

Given your stack and goals, a pragmatic phased rollout:

### Phase 1: Internal doc/FAQ RAG

Start with app docs (NovaWealth, analytics tools, etc.), product FAQs, and tutorials.

Implement:
- **Ingestion:** parse markdown/HTML → chunk → embed → vector DB.
- **Query:** simple semantic search + LLM answer with strong grounding instructions.
- Add basic metrics and logging.

This gives you a support assistant you can embed in your products and admin UIs fast.

### Phase 2: User‑specific financial RAG

Extend the KB with user portfolios, trades, and notes (respecting multi‑tenant isolation).

**Retrieval:**
- Filter by `user_id` before semantic search.
- Hybrid search for tickers and numeric fields.

**Generation:**
- Mix structured tool calls (for exact values) with RAG for explanations.
- Example: *"Why is my risk score higher this month?"* → tool fetches portfolio stats, RAG explains based on a KB of risk explanations.

### Phase 3: Language‑learning RAG

**Corpus:** your lessons, grammar explanations, example sentences, user's history.

**Retrieval:**
- Filter by target language and level.

**Generation:**
- Answer grammar questions grounded in your teaching style and content.

---

## Common Pitfalls to Avoid

1. **Over-chunking or under-chunking:** too small → noisy, too large → irrelevant context and wasted tokens.
2. **Ignoring metadata:** not filtering by user/tenant or language leads to leakage and bad relevance.
3. **No evaluation loop:** shipping without a feedback or evaluation framework makes improvement guesswork.
4. **Treating RAG as just "LLM with context":** latency, security, and observability quickly become problems at scale.

---

## Vector DB: What It Is and How Supabase Fits

### What a Vector DB Actually Is

In a vector DB, each record stores:
- An **ID** (like a primary key)
- A **vector** (e.g., 768‑dimensional float array from your embedding model)
- Optional **metadata** (text, tags, user_id, timestamps, etc.)

The database builds special indexes (HNSW, IVF, etc.) so it can very quickly answer: *"Give me the 10 stored vectors most similar to this query vector."*

This similarity search is what powers semantic search and RAG: you embed the user's question, ask the vector DB for nearest neighbors, then feed those chunks to your LLM.

> Think of it as: traditional DB = `WHERE id = 123`; vector DB = `WHERE meaning is most similar to this query`.

### How Supabase Fits In

Supabase is a hosted Postgres stack (auth, storage, etc.), and they ship a **Vector toolkit** built on the `pgvector` extension:

- Supabase + pgvector lets you:
  - Store embeddings in a `vector` column in regular Postgres tables.
  - Create indexes on that vector column for fast similarity search.
  - Combine vector search with SQL filters (e.g., `user_id`, `language`, `created_at`).

- Supabase explicitly markets this as an "open source vector database and AI toolkit" rather than a separate product.

So:
- **Supabase out of the box** = relational DB.
- **Supabase with pgvector enabled + proper schema/indexes** = fully capable vector DB you can use for RAG.

Given your stack and that you already use Supabase, you don't need Pinecone/Qdrant unless you want specialized features; **Supabase Vector is enough to build serious RAG.**

### How You'd Use Supabase as Your Vector DB (High Level)

1. **Create a table:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `content` | text | Original chunk text |
| `metadata` | jsonb | Source type, tags, user_id, etc. |
| `embedding` | vector(1536) | Embedding vector (dimension depends on model) |

2. **Enable pgvector** in Supabase (Database → Extensions → enable `vector`).

3. **Ingest data:**
   - Chunk your docs.
   - Use an embedding model (OpenAI / Anthropic / open‑source) in your code to turn each chunk into an embedding.
   - Insert rows into that table with `content`, `metadata`, and `embedding` filled.

4. **Query for RAG:**
   - For each user query, compute an embedding for the query.
   - Run a SQL statement like `ORDER BY embedding <-> query_embedding LIMIT k` (that `<->` is the distance operator from pgvector).
   - Feed the top‑k `content` values into your Claude prompt.

All of this can be generated/maintained with Claude Code; you just treat Supabase as your unified relational + vector store.
