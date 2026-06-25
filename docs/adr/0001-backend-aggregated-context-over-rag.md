# Exam generation uses backend-aggregated structured context, not RAG

The exam-generation feature (`backend/generation.py`) needs to tell the JamAI generation
table which topics/questions students struggled with, so it can draft a new exam that
targets weak areas (e.g. "focus on the topic many students failed"). We aggregate
per-question and per-topic average scores in Python from the course's prior exams into a
compact JSON summary, and send that plus the teacher's prompt to the generation table.

We deliberately did **not** use RAG (embedding past questions/answers/feedback into a vector
store) or give the agent live access to the database. "Many students failed this topic" is a
computed quantitative aggregate, not a semantic-similarity match, so RAG's retrieval model is
the wrong fit; live DB access would mean unreliable text-to-SQL (or dumping raw rows) for
something the backend can already compute deterministically and cheaply. RAG would become
worth revisiting only if generation needs to draw from unstructured sources (e.g. textbooks,
lecture notes) rather than structured score data.
