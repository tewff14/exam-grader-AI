"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, BookOpen, BarChart3, Sparkles } from "lucide-react";

const LINKS = [
  { href: "/", label: "Courses", icon: BookOpen },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/generate", label: "Generate Exam", icon: Sparkles },
];

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/courses") : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-200">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-semibold text-base tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-700 bg-clip-text text-transparent">
            ExamGrad <span className="text-indigo-600 font-bold">AI</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl transition-all duration-200 ${
                  active
                    ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100/50"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-500"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center gap-3">
          <div className="h-8 w-px bg-zinc-200" />
          <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/50">
            Teacher Mode
          </span>
        </div>
      </div>
    </header>
  );
}

