"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { generateExam, listCourses, type Course } from "@/lib/api";
import {
  Wand2,
  Sparkles,
  BookOpen,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  Calendar,
  FileText
} from "lucide-react";

export default function GenerateExamPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [semester, setSemester] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        setCourses(await listCourses());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load courses");
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !name.trim() || !prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const exam = await generateExam(courseId, { name: name.trim(), semester: semester || null, prompt: prompt.trim() });
      router.push(`/courses/${courseId}/exams/${exam.exam_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate exam");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-zinc-200/50 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-indigo-500" />
          <span>AI Exam Generator</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-1.5 max-w-2xl">
          Leverage historical student performance data to automatically draft new, targeted exams addressing prior class weaknesses.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 flex items-start gap-3 text-rose-700 animate-slide-up">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* 2-Column Content Layout */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Info Column (Left) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/20 p-5 space-y-4">
            <h3 className="font-semibold text-indigo-950 text-sm flex items-center gap-1.5">
              <Info className="h-4 w-4 text-indigo-500" />
              <span>How it works</span>
            </h3>
            
            <ul className="space-y-3.5 text-xs text-indigo-900/80 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Data aggregation:</strong> The system summarizes student errors and weak topics from prior exams in the chosen course.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Custom prompt instructions:</strong> Specify formatting rules, topic weights, or focus areas (e.g. &quot;Focus 80% on Algebra &quot;).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  <strong>AI synthesis:</strong> The scoring engine generates questions, topics, solutions, and max scores, saving them as a <strong>draft</strong> exam.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 space-y-3 shadow-sm">
            <h4 className="font-semibold text-zinc-900 text-xs uppercase tracking-wider">Example Prompts</h4>
            <div className="space-y-2 text-xs text-zinc-600">
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 font-mono">
                &quot;Propose 5 questions focusing strictly on topics where the class average was below 60%.&quot;
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100 font-mono">
                &quot;Create a cumulative midterm focusing on Algebra and Functions, scaling the questions to be easy-to-hard.&quot;
              </div>
            </div>
          </div>
        </div>

        {/* Form Column (Right) */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-100">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Select Course
                </label>
                <select
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none transition-all text-zinc-700"
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.course_id} value={c.course_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Draft Exam Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-zinc-400">
                      <FileText className="h-4 w-4" />
                    </span>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Remedial Quiz"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Semester
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-zinc-400">
                      <Calendar className="h-4 w-4" />
                    </span>
                    <input
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="e.g. Fall Semester"
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  AI Focus & Guidelines Instructions
                </label>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Provide explicit instructions for the AI generator, e.g.: Propose 6 Algebra questions. Make sure questions are challenging and focus on areas where student score averages were lowest last week."
                  rows={4}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all resize-y"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating || !courseId || !name.trim() || !prompt.trim()}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Synthesizing Exam Questions…</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    <span>Generate Draft Exam</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

