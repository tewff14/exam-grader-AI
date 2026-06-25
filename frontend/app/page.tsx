"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createCourse, deleteCourse, listCourses, type Course } from "@/lib/api";
import { Plus, Trash2, Calendar, BookOpen, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setCourses(await listCourses());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(load);
  }, []);

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm("Delete this course and all its exams, questions, and student papers? This cannot be undone.")) return;
    try {
      setCourses(await deleteCourse(courseId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await createCourse({ name: name.trim(), academic_year: academicYear ? Number(academicYear) : null });
      setName("");
      setAcademicYear("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Courses</h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            Manage your academic subjects, set up exams, and grade student submissions.
          </p>
        </div>
      </div>

      {/* Grid Layout: Form on Left/Top (1/3), Courses Grid on Right/Bottom (2/3) */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Create Course Form Panel */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Plus className="h-4.5 w-4.5" />
              </div>
              <h2 className="font-semibold text-zinc-900">Create New Course</h2>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Course Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Intro to Computer Science"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Academic Year <span className="text-zinc-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3.5 flex items-center text-zinc-400">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/30 pl-10 pr-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating…</span>
                  </>
                ) : (
                  <span>Create Course</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Courses Listing */}
        <div className="lg:col-span-8 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 flex items-start gap-3 text-rose-700 animate-slide-up">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-semibold">Error:</span> {error}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="rounded-2xl border border-zinc-200/60 bg-white p-5 space-y-4 animate-pulse">
                  <div className="h-5 w-2/3 bg-zinc-150 rounded-md" />
                  <div className="h-4 w-1/3 bg-zinc-100 rounded-md" />
                  <div className="pt-2 flex justify-between">
                    <div className="h-4 w-16 bg-zinc-100 rounded-md" />
                    <div className="h-4 w-12 bg-zinc-100 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center flex flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-400 mb-4 border border-zinc-100">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-zinc-900 text-lg">No courses yet</h3>
              <p className="text-zinc-500 text-sm max-w-sm mt-1">
                Get started by creating your first course using the creation form on the left.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {courses.map((course) => (
                <div
                  key={course.course_id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 hover:border-indigo-400 hover:shadow-md hover:shadow-indigo-50/20 transition-all duration-300"
                >
                  <Link href={`/courses/${course.course_id}`} className="block focus:outline-none">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteCourse(course.course_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all duration-200 cursor-pointer"
                        title="Delete Course"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {course.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mt-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          {course.academic_year ? `Academic Year ${course.academic_year}` : "No Academic Year Set"}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                    <span>ID: {course.course_id}</span>
                    <Link
                      href={`/courses/${course.course_id}`}
                      className="flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      <span>Manage Course</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

