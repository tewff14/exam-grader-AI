"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStats, listCourses, listExams, type Course, type Exam, type StatsResponse } from "@/lib/api";
import {
  BarChart3,
  Users,
  Percent,
  CheckCircle2,
  Filter,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  FolderKanban,
  BookOpen,
  ArrowRight,
  TrendingDown,
  ChevronRight,
  Loader2
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scored: "#10b981", // emerald-500
  error: "#f43f5e",  // rose-500
  processing: "#6366f1", // indigo-500
  queued: "#a1a1aa", // zinc-400
};

const STATUS_LABELS: Record<string, string> = {
  scored: "Graded",
  error: "Failed",
  processing: "Scoring",
  queued: "Queued",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass
}: {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm hover:shadow-md transition duration-200 flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-zinc-900">{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgClass} ${colorClass} border border-zinc-100/50`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}

function PercentBar({ label, percent, count }: { label: string; percent: number; count: number }) {
  const getBarColor = (pct: number) => {
    if (pct < 50) return "bg-gradient-to-r from-rose-500 to-rose-400";
    if (pct < 70) return "bg-gradient-to-r from-amber-500 to-amber-400";
    return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  };

  return (
    <div className="space-y-1.5 p-3 rounded-xl hover:bg-zinc-50 transition duration-150">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-700 font-medium truncate pr-4">{label}</span>
        <span className="font-semibold text-zinc-900 shrink-0 bg-zinc-100 px-2 py-0.5 rounded text-xs">
          {percent}% ({count} {count === 1 ? "paper" : "papers"})
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden border border-zinc-200/20">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor(percent)}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>(undefined);
  const [examId, setExamId] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        setCourses(await listCourses());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load courses");
      }
    });
  }, []);

  useEffect(() => {
    if (courseId === undefined) {
      Promise.resolve().then(() => {
        setExams([]);
        setExamId(undefined);
      });
      return;
    }
    listExams(courseId)
      .then(setExams)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load exams"));
  }, [courseId]);

  useEffect(() => {
    setIsLoading(true);
    getStats(courseId, examId)
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"))
      .finally(() => setIsLoading(false));
  }, [courseId, examId]);

  const getPercentageColor = (pct: number) => {
    if (pct < 50) return "bg-rose-50 border-rose-100 text-rose-700";
    if (pct < 70) return "bg-amber-50 border-amber-100 text-amber-700";
    return "bg-emerald-50 border-emerald-100 text-emerald-700";
  };

  const getPieChartData = () => {
    if (!stats) return [];
    return stats.status_breakdown.map(entry => ({
      ...entry,
      name: STATUS_LABELS[entry.status] || entry.status
    }));
  };

  if (error) {
    return (
      <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 flex items-start gap-3 text-rose-700">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Performance Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            Monitor scores, status breakdowns, and topic-wise performance across your exams.
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold uppercase mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>
          <select
            value={courseId ?? ""}
            onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={examId ?? ""}
            onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={courseId === undefined}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 focus:outline-none focus:border-indigo-500 shadow-sm disabled:opacity-50"
          >
            <option value="">All Exams</option>
            {exams.map((e) => (
              <option key={e.exam_id} value={e.exam_id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading || !stats ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-zinc-500 text-sm">Aggregating stats...</p>
        </div>
      ) : (
        <>
          {/* KPI Dashboard Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Papers"
              value={String(stats.total_papers)}
              icon={FolderKanban}
              colorClass="text-zinc-700"
              bgClass="bg-zinc-100"
            />
            <KpiCard
              label="Graded Papers"
              value={String(stats.scored_papers)}
              icon={CheckCircle2}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-50"
            />
            <KpiCard
              label="Average Score"
              value={stats.average_percent !== null ? `${stats.average_percent}%` : "—"}
              icon={Percent}
              colorClass="text-indigo-600"
              bgClass="bg-indigo-50"
            />
            <KpiCard
              label="Pass Rate (≥50%)"
              value={stats.pass_rate !== null ? `${stats.pass_rate}%` : "—"}
              icon={TrendingUp}
              colorClass="text-violet-600"
              bgClass="bg-violet-50"
            />
          </div>

          {/* Core Analytics Grids */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Chart 1: Average by Grade Year */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-zinc-400" />
                <span>Average Score by Grade Year</span>
              </h2>
              <div className="h-[280px]">
                {stats.average_by_grade_year.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                    No graded student papers available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.average_by_grade_year} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorGrading" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="grade_year" tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                      <YAxis unit="%" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none" }}
                        labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                        itemStyle={{ color: "#ffffff", fontSize: "13px" }}
                        formatter={(value) => [`${value}%`, "Avg Score"]}
                      />
                      <Bar dataKey="average_percent" fill="url(#colorGrading)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Completion Status Breakdown */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-zinc-400" />
                <span>Completion Status</span>
              </h2>
              <div className="h-[280px]">
                {stats.status_breakdown.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                    No paper submissions found.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getPieChartData()}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                      >
                        {getPieChartData().map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#e4e4e7"} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none" }}
                        itemStyle={{ color: "#ffffff", fontSize: "13px" }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "12px", color: "#52525b" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Score Distribution Chart */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4 lg:col-span-2">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-zinc-400" />
                <span>Score Distribution</span>
              </h2>
              <div className="h-[280px]">
                {stats.score_distribution.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                    No scoring details available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.score_distribution} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorDistribution" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                      <XAxis dataKey="range" tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none" }}
                        labelStyle={{ color: "#a1a1aa", fontSize: "11px", fontWeight: "bold" }}
                        itemStyle={{ color: "#ffffff", fontSize: "13px" }}
                        formatter={(value) => [value, "Student Papers"]}
                      />
                      <Bar dataKey="count" fill="url(#colorDistribution)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Performance by Topic */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <BookOpen className="h-4.5 w-4.5 text-zinc-400" />
                <span>Performance by Topic</span>
              </h2>
              
              <div className="max-h-[380px] overflow-y-auto pr-2 divide-y divide-zinc-100">
                {stats.by_topic.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">No subject topics scored yet.</p>
                ) : (
                  stats.by_topic.map((row) => (
                    <PercentBar key={row.topic} label={row.topic} percent={row.average_percent} count={row.count} />
                  ))
                )}
              </div>
            </div>

            {/* Weakest Questions */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4">
              <div className="space-y-0.5">
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <TrendingDown className="h-4.5 w-4.5 text-rose-500" />
                  <span>Weakest Questions</span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Lowest average scoring questions. Recommended candidates to review in class.
                </p>
              </div>
              
              <div className="max-h-[360px] overflow-y-auto pr-2 divide-y divide-zinc-100">
                {stats.by_question.length === 0 ? (
                  <p className="text-sm text-zinc-400 py-4 text-center">No questions graded yet.</p>
                ) : (
                  stats.by_question.slice(0, 10).map((row) => (
                    <PercentBar
                      key={`${row.exam_name}-${row.question_no}`}
                      label={`${row.exam_name} • Q${row.question_no}: ${row.question_text}`}
                      percent={row.average_percent}
                      count={row.count}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Lowest Scoring Papers */}
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm space-y-4 lg:col-span-2">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 text-rose-500" />
                <span>Lowest-Scoring Student Papers</span>
              </h2>
              
              {stats.lowest_scoring.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-6">No graded papers available.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {stats.lowest_scoring.map((row) => {
                    const initials = row.first_name ? (row.first_name[0] + (row.last_name ? row.last_name[0] : "")).toUpperCase() : `#${row.paper_id}`;
                    return (
                      <div
                        key={row.paper_id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/80 bg-white hover:border-zinc-300 transition duration-150"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 font-semibold text-xs border border-zinc-200/50">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 truncate">
                              {[row.first_name, row.last_name].filter(Boolean).join(" ") || `Paper #${row.paper_id}`}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium truncate">
                              Student ID: {row.student_id || "—"}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold border ${getPercentageColor(row.percent)}`}>
                          {row.percent}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

