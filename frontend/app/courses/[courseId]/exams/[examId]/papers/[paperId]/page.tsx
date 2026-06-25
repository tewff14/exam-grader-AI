"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getPaper,
  paperImageUrl,
  patchAnswer,
  rescorePaper,
  type Answer,
  type PaperDetail,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  PenTool,
  CheckCircle,
  HelpCircle,
  UserCheck,
  Maximize2
} from "lucide-react";

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  queued: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-700", dot: "bg-zinc-400", label: "Queued" },
  processing: { bg: "bg-indigo-50 border-indigo-100 animate-pulse", text: "text-indigo-700", dot: "bg-indigo-500", label: "Scoring..." },
  scored: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Graded" },
  error: { bg: "bg-rose-50 border-rose-100", text: "text-rose-700", dot: "bg-rose-500", label: "Failed" },
};

function QuestionCard({
  answer,
  onOverride,
}: {
  answer: Answer;
  onOverride: (answerId: number, teacherScore: number | null) => void;
}) {
  const [draft, setDraft] = useState(answer.teacher_score?.toString() ?? "");
  const isAdjusted = answer.teacher_score !== null;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-sm hover:shadow-md transition duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center h-6 w-8 font-semibold rounded-lg bg-zinc-100 text-zinc-700 text-xs">
            Q{answer.question_no}
          </span>
          {answer.topic && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-md">
              {answer.topic}
            </span>
          )}
        </div>
        {isAdjusted && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
            <UserCheck className="h-3 w-3" />
            Teacher Adjusted
          </span>
        )}
      </div>

      <div className="text-sm font-medium text-zinc-900 leading-relaxed">
        {answer.question_text}
      </div>

      {/* Student handwritten text block */}
      <div className="rounded-xl bg-zinc-50 border border-zinc-200/60 p-4 space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Student Answer (OCR Extracted)
        </span>
        <p className="text-sm text-zinc-800 font-mono whitespace-pre-wrap leading-relaxed">
          {answer.student_answer || <span className="text-zinc-300 italic">No answer detected.</span>}
        </p>
      </div>

      {/* AI Evaluator feedback */}
      <div className="rounded-xl bg-indigo-50/30 border border-indigo-100/50 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-indigo-700">
          <Sparkles className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            AI Agent Feedback
          </span>
        </div>
        <p className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
          {answer.agent_feedback || <span className="text-zinc-400 italic">AI feedback not generated.</span>}
        </p>
      </div>

      {/* Grading Override actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-zinc-100">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 uppercase font-semibold">AI Grading:</span>
          <span className="text-sm font-semibold text-zinc-800">
            {answer.agent_score !== null ? `${answer.agent_score}` : "—"} / {answer.max_points ?? "—"}
          </span>
          
          {isAdjusted && (
            <span className="text-xs text-zinc-400 uppercase font-semibold pl-2 border-l border-zinc-200">
              Final Score: <span className="font-bold text-indigo-600 text-sm">{answer.teacher_score}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-[10px] font-bold uppercase text-zinc-400 select-none">
              Score:
            </span>
            <input
              type="number"
              step="any"
              min="0"
              max={answer.max_points ?? undefined}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const value = draft === "" ? null : Number(draft);
                if (value !== answer.teacher_score) onOverride(answer.answer_id, value);
              }}
              placeholder="Override"
              className="w-32 rounded-lg border border-zinc-200 bg-zinc-50/50 pl-12 pr-2 py-1.5 text-xs font-semibold focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
            />
          </div>
          {isAdjusted && (
            <button
              onClick={() => {
                setDraft("");
                onOverride(answer.answer_id, null);
              }}
              className="text-xs text-zinc-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GradingPage() {
  const { courseId, examId, paperId } = useParams<{ courseId: string; examId: string; paperId: string }>();
  const cId = Number(courseId);
  const eId = Number(examId);
  const pId = Number(paperId);

  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);

  const load = async () => {
    try {
      setPaper(await getPaper(pId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load paper");
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, [pId]);

  // Poll while the paper hasn't reached a terminal status (e.g. after Re-score).
  useEffect(() => {
    if (!paper || paper.status === "scored" || paper.status === "error") return;
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [paper?.status, pId]);

  const handleOverride = async (answerId: number, teacherScore: number | null) => {
    try {
      await patchAnswer(answerId, { teacher_score: teacherScore });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save override");
    }
  };

  const handleRescore = async () => {
    if (!confirm("Re-score this student paper? This will trigger AI re-evaluation, but your existing teacher score overrides will be preserved.")) return;
    setIsRescoring(true);
    setError(null);
    try {
      await rescorePaper(pId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-score paper");
    } finally {
      setIsRescoring(false);
    }
  };

  if (!paper) {
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
            <p className="text-zinc-500 text-sm">Loading submission grading details…</p>
          </div>
        )}
      </div>
    );
  }

  const badge = STATUS_BADGES[paper.status] || STATUS_BADGES.queued;
  const isPending = paper.status === "queued" || paper.status === "processing";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Navigation */}
      <div className="border-b border-zinc-200/50 pb-6 space-y-3">
        <Link
          href={`/courses/${cId}/exams/${eId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Exam Detail</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-950">
              {[paper.first_name, paper.last_name].filter(Boolean).join(" ") || "Student Submission"}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-zinc-500 text-xs mt-1.5">
              <span className="font-mono text-zinc-700 font-medium bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200/50">
                Student ID: {paper.student_id}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              {paper.total_score !== null && paper.max_score ? (
                <span className="font-semibold text-indigo-600 text-sm">
                  Total Grade: {paper.total_score} / {paper.max_score} ({Math.round((paper.total_score! / paper.max_score!) * 100)}%)
                </span>
              ) : (
                <span className="text-zinc-400">Total Grade: Not Scored</span>
              )}
            </div>
          </div>

          <button
            onClick={handleRescore}
            disabled={isRescoring || isPending}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-50 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {isRescoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Re-scoring…</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Re-score submission</span>
              </>
            )}
          </button>
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

      {/* Main Split-Screen Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Side: Student Paper Image Viewer */}
        <div className="lg:col-span-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-100 p-2 shadow-sm overflow-hidden flex flex-col items-center justify-center relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={paperImageUrl(paper.paper_id)}
              alt="Student submission scan"
              className="w-full max-h-[70vh] lg:max-h-[calc(100vh-210px)] object-contain rounded-xl shadow-inner transition-transform duration-300 hover:scale-105"
            />
            <div className="absolute bottom-4 right-4 bg-zinc-900/80 backdrop-blur text-white p-2 rounded-xl border border-zinc-700 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Hover to Zoom</span>
            </div>
          </div>
        </div>

        {/* Right Side: Questions & Scoring details */}
        <div className="lg:col-span-6 space-y-4 overflow-y-auto max-h-[85vh] lg:max-h-[calc(100vh-190px)] pr-2">
          {paper.answers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center flex flex-col items-center justify-center">
              {paper.status === "error" ? (
                <>
                  <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
                  <h4 className="font-semibold text-zinc-950">Scoring Agent Failed</h4>
                  <p className="text-sm text-zinc-500 max-w-sm mt-1">
                    {paper.error || "An unknown error occurred during grading."}
                  </p>
                  <button
                    onClick={handleRescore}
                    className="mt-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-4 py-2 text-xs hover:bg-indigo-100 transition cursor-pointer"
                  >
                    Attempt Re-score
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mb-3" />
                  <h4 className="font-semibold text-zinc-950">AI Grading In Progress...</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    AI agent is currently performing question parsing and scoring. This page will refresh automatically.
                  </p>
                </>
              )}
            </div>
          ) : (
            paper.answers.map((a) => (
              <QuestionCard key={a.answer_id} answer={a} onOverride={handleOverride} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

