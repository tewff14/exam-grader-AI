"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  createQuestion,
  deletePaper,
  deleteQuestion,
  finalizeExam,
  getExam,
  listPapers,
  listQuestions,
  listRoster,
  patchQuestion,
  uploadPaper,
  type Exam,
  type Question,
  type Student,
  type StudentPaper,
} from "@/lib/api";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  ArrowRight,
  User,
  CheckCircle,
  FileCheck2,
  Clock
} from "lucide-react";

const TERMINAL = new Set(["scored", "error"]);

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  queued: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700", dot: "bg-zinc-400", label: "Queued" },
  processing: { bg: "bg-indigo-50 border-indigo-100 animate-pulse", text: "text-indigo-700", dot: "bg-indigo-500", label: "Scoring..." },
  scored: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Graded" },
  error: { bg: "bg-rose-50 border-rose-100", text: "text-rose-700", dot: "bg-rose-500", label: "Failed" },
};

export default function ExamDetailPage() {
  const { courseId, examId } = useParams<{ courseId: string; examId: string }>();
  const cId = Number(courseId);
  const eId = Number(examId);

  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roster, setRoster] = useState<Student[]>([]);
  const [papers, setPapers] = useState<StudentPaper[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState<Record<number, boolean>>({});

  const [selectedStudent, setSelectedStudent] = useState("");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [e, q, r] = await Promise.all([getExam(eId), listQuestions(eId), listRoster(cId)]);
      setExam(e);
      setQuestions(q);
      setRoster(r);
      if (e.status === "ready") setPapers(await listPapers(eId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam");
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, [eId, cId]);

  // Poll the paper list while any paper hasn't reached a terminal status.
  const pendingKey = papers.filter((p) => !TERMINAL.has(p.status)).map((p) => p.paper_id).join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const interval = setInterval(async () => {
      try {
        setPapers(await listPapers(eId));
      } catch {
        // Transient network error — keep polling silently.
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pendingKey, eId]);

  const updateQuestionField = (questionId: number, field: keyof Question, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.question_id === questionId
          ? { ...q, [field]: field === "max_points" ? (value === "" ? null : Number(value)) : value }
          : q
      )
    );
  };

  const saveQuestion = async (question: Question) => {
    setSavingQuestions((prev) => ({ ...prev, [question.question_id]: true }));
    try {
      await patchQuestion(question.question_id, {
        text: question.text,
        topic: question.topic ?? undefined,
        max_points: question.max_points ?? undefined,
        solution: question.solution ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setSavingQuestions((prev) => ({ ...prev, [question.question_id]: false }));
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm("Delete this question? This also deletes its answers from every student paper. This cannot be undone.")) return;
    try {
      setQuestions(await deleteQuestion(questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete question");
    }
  };

  const handleDeletePaper = async (paperId: number) => {
    if (!confirm("Delete this student paper and its answers? This cannot be undone.")) return;
    try {
      setPapers(await deletePaper(paperId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete paper");
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setIsAddingQuestion(true);
    setError(null);
    try {
      setQuestions(await createQuestion(eId, { text: newQuestionText.trim() }));
      setNewQuestionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm("Finalize this exam? You won't be able to edit, add, or delete questions after this, but you can upload student papers for grading.")) return;
    setIsFinalizing(true);
    setError(null);
    try {
      setExam(await finalizeExam(eId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize exam");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleUploadPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !paperFile) return;
    setIsUploading(true);
    setError(null);
    try {
      const paper = await uploadPaper(eId, selectedStudent, paperFile);
      setPapers((prev) => [paper, ...prev]);
      setPaperFile(null);
      setSelectedStudent("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload paper");
    } finally {
      setIsUploading(false);
    }
  };

  const getStudentName = (studentId: string) => {
    const s = roster.find((r) => r.student_id === studentId);
    if (!s) return "Unnamed Student";
    return [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed Student";
  };

  if (!exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-2 max-w-md">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
            <p className="text-zinc-500 text-sm">Loading exam details…</p>
          </div>
        )}
      </div>
    );
  }

  const isDraft = exam.status === "draft";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Breadcrumbs and Top Header */}
      <div className="border-b border-zinc-200/50 pb-6 space-y-3">
        <Link
          href={`/courses/${cId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Course Details</span>
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-950">{exam.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isDraft ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-emerald-50 border-emerald-100 text-emerald-700"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isDraft ? "bg-amber-500" : "bg-emerald-500"}`} />
                {isDraft ? "Draft" : "Finalized"}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mt-1.5">
              {exam.semester ?? "No semester set"} &bull; Created {new Date(exam.created_at).toLocaleDateString()}
            </p>
          </div>

          {isDraft && (
            <button
              onClick={handleFinalize}
              disabled={isFinalizing || questions.length === 0}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isFinalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Finalizing…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Finalize Exam</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 flex items-start gap-3 text-rose-700 animate-slide-up">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Main Grid: Questions & Upload Cards */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Questions list (takes left side) */}
        <div className={`${isDraft ? "lg:col-span-8" : "lg:col-span-7"} space-y-6`}>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              <span>Exam Questions</span>
              <span className="text-xs font-normal text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/50 ml-1.5">
                {questions.length} Total
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Add questions, specify subject topics, maximum grade points, and the reference solution key. {isDraft && "Changes autosave on click outside."}
            </p>
          </div>

          <div className="space-y-4">
            {questions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center flex flex-col items-center justify-center">
                <HelpCircle className="h-8 w-8 text-zinc-300 mb-2" />
                <span className="text-zinc-500 text-sm font-medium">No questions defined</span>
                <span className="text-zinc-400 text-xs mt-0.5">Add questions manually below to get started.</span>
              </div>
            ) : (
              questions.map((q) => (
                <div
                  key={q.question_id}
                  className="rounded-2xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-sm hover:border-zinc-300/80 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-6 w-8 font-semibold rounded-lg bg-indigo-50 text-indigo-700">
                        Q{q.question_no}
                      </span>
                      {savingQuestions[q.question_id] ? (
                        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                          Saving...
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400">Autosaved</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-400">Topic:</span>
                        <input
                          disabled={!isDraft}
                          value={q.topic ?? ""}
                          onChange={(e) => updateQuestionField(q.question_id, "topic", e.target.value)}
                          onBlur={() => saveQuestion(q)}
                          placeholder="e.g. Algebra"
                          className="bg-transparent text-zinc-700 font-medium placeholder:text-zinc-300 focus:outline-none w-20 text-xs text-center"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1">
                        <span className="text-[10px] uppercase font-bold text-zinc-400">Max Pts:</span>
                        <input
                          disabled={!isDraft}
                          type="number"
                          min="1"
                          value={q.max_points ?? ""}
                          onChange={(e) => updateQuestionField(q.question_id, "max_points", e.target.value)}
                          onBlur={() => saveQuestion(q)}
                          placeholder="e.g. 5"
                          className="bg-transparent text-zinc-700 font-semibold placeholder:text-zinc-300 focus:outline-none w-10 text-xs text-center"
                        />
                      </div>

                      {isDraft && (
                        <button
                          onClick={() => handleDeleteQuestion(q.question_id)}
                          className="p-1 text-zinc-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        Question Description
                      </label>
                      <textarea
                        disabled={!isDraft}
                        value={q.text}
                        onChange={(e) => updateQuestionField(q.question_id, "text", e.target.value)}
                        onBlur={() => saveQuestion(q)}
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50/20 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all resize-y"
                        rows={2}
                        placeholder="Write the question prompt here..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-1">
                        Reference Solution Key
                      </label>
                      <textarea
                        disabled={!isDraft}
                        value={q.solution ?? ""}
                        onChange={(e) => updateQuestionField(q.question_id, "solution", e.target.value)}
                        onBlur={() => saveQuestion(q)}
                        placeholder="Author the solution here. The AI agent will grade papers against this."
                        className="w-full rounded-xl border border-indigo-100 bg-indigo-50/10 px-3.5 py-2.5 text-sm placeholder:text-indigo-300 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all resize-y text-zinc-800"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {isDraft && (
            <form
              onSubmit={handleAddQuestion}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 flex gap-3 items-end"
            >
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Add New Question
                </label>
                <input
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Enter question prompt..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={isAddingQuestion || !newQuestionText.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4.5 py-2.5 h-10 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center shrink-0 cursor-pointer"
              >
                {isAddingQuestion ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Add</span>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Action Panel / Papers Panel (takes right side) */}
        <div className={`${isDraft ? "lg:col-span-4" : "lg:col-span-5"} space-y-6`}>
          {isDraft ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/30 p-6 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500 border border-amber-100">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-zinc-950 text-sm">Exam is in Draft Mode</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Review the questions, assign topics, and author the reference solutions. Once finalized, you can start uploading and grading student papers.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleFinalize}
                  disabled={isFinalizing || questions.length === 0}
                  className="w-full rounded-xl bg-indigo-50 hover:bg-indigo-100/80 px-4 py-2.5 text-xs font-semibold text-indigo-700 border border-indigo-200/50 transition cursor-pointer"
                >
                  Finalize to Upload Papers
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Upload Student Paper Card */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-100 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Upload className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="font-semibold text-zinc-950">Upload Student Paper</h3>
                </div>

                <form onSubmit={handleUploadPaper} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Select Student
                    </label>
                    <select
                      required
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    >
                      <option value="">Choose student roster...</option>
                      {roster.map((s) => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.student_id} — {[s.first_name, s.last_name].filter(Boolean).join(" ") || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Handwritten Answer Sheet Image
                    </label>
                    <div className="relative border border-dashed border-zinc-300 rounded-xl p-4 bg-zinc-50 hover:bg-zinc-100/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <Upload className="h-6 w-6 text-zinc-400 mb-2" />
                      <span className="text-xs font-medium text-zinc-700">
                        {paperFile ? paperFile.name : "Select paper image"}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1">
                        PNG, JPG, or WEBP student submission
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || !selectedStudent || !paperFile}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading & Queuing…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Upload for Grading</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Student Papers Listing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-indigo-500" />
                    <span>Grading Submissions</span>
                  </h3>
                  {pendingKey && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Updating...
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {papers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-zinc-400">
                      No student papers uploaded yet. Upload student submissions above.
                    </div>
                  ) : (
                    papers.map((p) => {
                      const badge = STATUS_BADGES[p.status] || STATUS_BADGES.queued;
                      const hasScore = p.total_score !== null && p.max_score !== null;
                      
                      return (
                        <div
                          key={p.paper_id}
                          className="group relative flex items-center justify-between p-4 rounded-xl border border-zinc-200/80 bg-white hover:border-indigo-300 hover:shadow-sm transition-all duration-200"
                        >
                          <Link
                            href={`/courses/${cId}/exams/${eId}/papers/${p.paper_id}`}
                            className="flex-1 min-w-0 pr-6"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-semibold text-sm text-zinc-900 truncate">
                                {getStudentName(p.student_id)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text}`}>
                                <span className={`h-1 w-1 rounded-full ${badge.dot}`} />
                                {badge.label}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                              <span className="font-mono text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">
                                ID: {p.student_id}
                              </span>
                              <span>&bull;</span>
                              {hasScore ? (
                                <span className="font-semibold text-indigo-600">
                                  Grade: {p.total_score} / {p.max_score} ({Math.round((p.total_score! / p.max_score!) * 100)}%)
                                </span>
                              ) : (
                                <span>No score computed</span>
                              )}
                            </div>
                          </Link>

                          <div className="flex items-center gap-3">
                            <Link
                              href={`/courses/${cId}/exams/${eId}/papers/${p.paper_id}`}
                              className="inline-flex h-8 px-2.5 items-center justify-center text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            >
                              Grade
                            </Link>
                            <button
                              onClick={() => handleDeletePaper(p.paper_id)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Delete Submission"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

