# Exam Grading Platform

Lets teachers organize subjective exams by course, score student papers per-question against
a teacher-authored answer key, and generate new exams from past performance data.

## Language

**Course**:
A named collection of Exams for a given Academic Year, with a roster of enrolled Students.
_Avoid_: Class, subject

**Academic Year**:
The calendar year a Course runs in (e.g. 2026). Distinct from a Student's Grade Year.

**Exam**:
A single test within a Course, identified by a semester/term. Owns a set of Questions and
stays in `draft` status until the teacher finalizes it to `ready`, at which point it can
receive Student Papers.
_Avoid_: Test (for the structured entity; fine as a casual synonym elsewhere)

**Question**:
One question belonging to an Exam: its text, a Topic, a teacher-entered max point value, and
a teacher-authored Solution. Either extracted from an uploaded question paper or authored
manually by the teacher.

**Solution**:
The teacher-authored reference answer for one Question, used by the scoring agent to grade
Student Papers. Always written by the teacher, even if the source question paper happened to
include answers.
_Avoid_: Answer key

**Topic**:
A label grouping Questions by subject area: auto-assigned during question extraction, or
teacher-entered for a manually authored Question. Always editable by the teacher. Used to find
areas where many students underperformed.

**Student Paper**:
One enrolled Student's submitted answer sheet for an Exam, scored per-question.
_Avoid_: Submission, test paper

**Answer**:
One Student's response to one Question of a Student Paper: the OCR'd text, the agent's score
and feedback, and an optional teacher override. The effective score is the teacher override
if set, otherwise the agent's score.

**Grade Year**:
A Student's own year-of-study (e.g. grade 10), independent of a Course's Academic Year.
_Avoid_: Year alone — always say "Grade Year" for the student's level, or "Academic Year" for
the Course's year.
