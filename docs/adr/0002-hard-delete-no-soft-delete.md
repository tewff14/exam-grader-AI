# Teacher deletes are hard deletes, not soft deletes

Teachers can now delete a Course, Exam, Question, or Student Paper. Deleting a Course or Exam
cascades to everything beneath it (Exams → Questions/Student Papers → Answers, Enrollments), and
deleting a Question cascades to its Answer rows across every paper that has one.

We deliberately chose **hard delete** (rows removed from SQLite, image files removed from disk)
over a soft-delete/archive flag. There is no audit or undo concept anywhere else in this app, so
adding one just for deletes would be inconsistent with everything else, and `stats.py` /
`generation.py` already recompute their aggregates live from whatever rows currently exist — no
caching to invalidate, no stored snapshot to reconcile.

The trade-off: deleting a Course permanently removes its historical per-question/topic
performance from `generation.py`'s `_course_performance` and from `stats.py`'s dashboard
aggregates. There is no way to recover it short of re-uploading and re-scoring every paper. If a
future need arises to delete a Course from active use while still keeping its performance data
for exam generation or reporting, that's a sign to revisit this as a soft-delete/archive instead.
