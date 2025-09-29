"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format, addMinutes, isBefore, parseISO } from "date-fns";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarDays,
  GitCommit,
  Clock,
  AlertTriangle,
  LayoutGrid,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  mapClickUpTasks,
  type DPTask,
  type ClickUpTasksResponse,
} from "@/lib/clickup-adapter";

const sortOptions = ["due", "priority", "progress", "alpha"] as const;
type SortOption = (typeof sortOptions)[number];
type Priority = DPTask["priority"];
type TaskStatus = DPTask["status"];

type TaskWithDependents = {
  task: DPTask;
  subtasks: DPTask[];
  allSubtasks: DPTask[];
};

const isSortOption = (value: string): value is SortOption =>
  sortOptions.includes(value as SortOption);

const prioHue: Record<Priority, string> = {
  urgent:
    "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40",
  high:
    "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40",
  medium:
    "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-500/40",
  low:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/40",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

const statusOrder: TaskStatus[] = ["todo", "in_progress", "review", "done"];

function formatMinutesLabel(minutes?: number) {
  if (!minutes) return null;
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  if (minutes > 120) {
    return `${(minutes / 60).toFixed(1)}h`;
  }
  return `${minutes}m`;
}

function suggestDayPlan(tasks: DPTask[], startISO?: string) {
  const start = startISO ? parseISO(startISO) : new Date();
  const queue = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const da = a.due ? parseISO(a.due) : undefined;
      const db = b.due ? parseISO(b.due) : undefined;
      const dueCmp =
        da && db ? da.getTime() - db.getTime() : da ? -1 : db ? 1 : 0;
      const pr: Record<Priority, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      const prioCmp = pr[a.priority] - pr[b.priority];
      const estCmp = (a.estimateMin || 9999) - (b.estimateMin || 9999);
      return dueCmp || prioCmp || estCmp;
    });

  const done = new Set<string>();
  const scheduled: Array<{ task: DPTask; from: Date; to: Date }> = [];
  let cursor = start;
  const canRun = (t: DPTask) => (t.deps || []).every((d) => done.has(d));

  let guard = 1000;
  while (queue.length && guard--) {
    const idx = queue.findIndex(canRun);
    if (idx === -1) break;
    const task = queue.splice(idx, 1)[0];
    const dur = task.estimateMin ?? 60;
    const end = addMinutes(cursor, dur);
    scheduled.push({ task, from: cursor, to: end });
    cursor = end;
    done.add(task.id);
  }

  return scheduled;
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

function TaskIdBadge({ id, className = "" }: { id: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-gradient-to-r from-pink-500/15 via-cyan-500/15 to-transparent text-[11px] font-semibold uppercase tracking-wide text-pink-600 shadow-[0_0_14px_rgba(236,72,153,0.35)] dark:from-pink-500/20 dark:via-cyan-400/10 dark:text-pink-200 dark:shadow-[0_0_18px_rgba(236,72,153,0.45)] border-pink-500/40",
        className,
      )}
    >
      #{id}
    </Badge>
  );
}

export default function DreamPlannerApp() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("due");
  const [tab, setTab] = useState("tasks");
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>(
    {},
  );
  const [focusQueue, setFocusQueue] = useState<string[]>([]);

  const handleSortChange = (value: string) => {
    setSort(isSortOption(value) ? value : "due");
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleFocusTask = (taskId: string) => {
    setFocusQueue((queue) =>
      queue.includes(taskId)
        ? queue.filter((id) => id !== taskId)
        : [...queue, taskId],
    );
  };

  const { data, isLoading, error } = useQuery<ClickUpTasksResponse>({
    queryKey: ["clickup_tasks"],
    queryFn: async (): Promise<ClickUpTasksResponse> => {
      const res = await fetch("/api/clickup/tasks");
      if (!res.ok) throw new Error(`API ${res.status}`);
      return (await res.json()) as ClickUpTasksResponse;
    },
    refetchInterval: 60_000,
  });

  const tasks: DPTask[] = useMemo(() => {
    if (!data?.tasks) return [];
    const mapped = mapClickUpTasks(data.tasks);
    console.table(
      mapped.map(({ id, title, parentId }) => ({
        id,
        title,
        parentId,
      })),
    );
    return mapClickUpTasks(data.tasks);
  }, [data]);

  const childMap = useMemo(() => {
    const map = new Map<string, DPTask[]>();
    for (const task of tasks) {
      if (!task.parentId) continue;
      if (!map.has(task.parentId)) {
        map.set(task.parentId, []);
      }
      map.get(task.parentId)!.push(task);
    }
    return map;
  }, [tasks]);

  const milestoneGroups = useMemo(() => {
    const groups: Array<{ milestone: DPTask; children: DPTask[] }> = [];
    for (const task of tasks) {
      if (task.parentId) continue;
      const children = childMap.get(task.id);
      if (!children || !children.length) continue;
      groups.push({ milestone: task, children: [...children] });
    }

    return groups.sort((a, b) =>
      a.milestone.title.localeCompare(b.milestone.title),
    );
  }, [tasks, childMap]);

  const queryLower = query.toLowerCase().trim();

  const filteredMilestones = useMemo(() => {
    const threshold = addMinutes(new Date(), 24 * 60);

    const matchesQuery = (task: DPTask) =>
      !queryLower.length ||
      task.title.toLowerCase().includes(queryLower) ||
      (task.tags || []).some((tag) => tag.toLowerCase().includes(queryLower));

    const matchesRisk = (task: DPTask) => {
      if (!showOnlyAtRisk) return true;
      if (!task.due) return false;
      return isBefore(parseISO(task.due), threshold);
    };

    const matchesFilters = (task: DPTask) =>
      matchesQuery(task) && matchesRisk(task);

    const compareTasks = (a: DPTask, b: DPTask) => {
      if (sort === "due") {
        const ad = a.due ? parseISO(a.due).getTime() : Infinity;
        const bd = b.due ? parseISO(b.due).getTime() : Infinity;
        return ad - bd;
      }
      if (sort === "priority") {
        const pr: Record<Priority, number> = {
          urgent: 0,
          high: 1,
          medium: 2,
          low: 3,
        };
        return pr[a.priority] - pr[b.priority];
      }
      if (sort === "progress") {
        return (a.progress ?? 0) - (b.progress ?? 0);
      }
      return a.title.localeCompare(b.title);
    };

    return milestoneGroups
      .map(({ milestone, children }) => {
        const actionable = children
          .map((child) => {
            const directSubtasks = childMap.get(child.id) ?? [];
            const sortedSubtasks = [...directSubtasks].sort(compareTasks);
            const parentMatches = matchesFilters(child);
            const matchingSubtasks = sortedSubtasks.filter(matchesFilters);
            const visibleSubtasks = parentMatches ? sortedSubtasks : matchingSubtasks;

            if (!parentMatches && visibleSubtasks.length === 0) {
              return null;
            }

            return {
              task: child,
              subtasks: visibleSubtasks,
              allSubtasks: sortedSubtasks,
            };
          })
          .filter(
            (entry): entry is TaskWithDependents => entry !== null,
          )
          .sort((a, b) => compareTasks(a.task, b.task));

        if (!actionable.length) return null;

        return {
          milestone,
          tasks: actionable,
        };
      })
      .filter(
        (
          group,
        ): group is {
          milestone: DPTask;
          tasks: TaskWithDependents[];
        } => group !== null,
      );
  }, [milestoneGroups, childMap, queryLower, showOnlyAtRisk, sort]);

  const actionableQueue = useMemo(
    () => filteredMilestones.flatMap((group) => group.tasks.map(({ task }) => task)),
    [filteredMilestones],
  );

  const focusSet = useMemo(() => new Set(focusQueue), [focusQueue]);

  const prioritizedQueue = useMemo(() => {
    if (!focusQueue.length) return actionableQueue;
    const prioritized: DPTask[] = [];
    const seen = new Set<string>();
    for (const id of focusQueue) {
      const task = actionableQueue.find((item) => item.id === id);
      if (task && !seen.has(task.id)) {
        prioritized.push(task);
        seen.add(task.id);
      }
    }
    for (const task of actionableQueue) {
      if (!seen.has(task.id)) {
        prioritized.push(task);
        seen.add(task.id);
      }
    }
    return prioritized;
  }, [actionableQueue, focusQueue]);

  const todayPlan = useMemo(
    () => suggestDayPlan(prioritizedQueue.slice(0, 8)),
    [prioritizedQueue],
  );

  const planSummary = useMemo(() => {
    if (!todayPlan.length) return null;
    const totalMinutes = todayPlan.reduce((acc, slot) => {
      const diff = slot.to.getTime() - slot.from.getTime();
      return acc + Math.max(0, Math.round(diff / 60000));
    }, 0);

    return {
      totalMinutes,
      start: todayPlan[0]?.from,
      end: todayPlan[todayPlan.length - 1]?.to,
    };
  }, [todayPlan]);

  const planStart = planSummary?.start;
  const planEnd = planSummary?.end;
  const planDurationLabel = planSummary?.totalMinutes
    ? formatMinutesLabel(planSummary.totalMinutes)
    : null;
  const scheduleHeadline =
    planStart && planEnd
      ? `${format(planStart, "EEE MMM d")} • ${format(planStart, "HH:mm")} – ${format(planEnd, "HH:mm")}${planDurationLabel ? ` · ${planDurationLabel}` : ""
      }`
      : "Plan upcoming tasks";

  const progressOverall = useMemo(() => {
    const vals = tasks.map((t) => t.progress ?? 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));
  }, [tasks]);

  const milestoneSummaries = useMemo(() => {
    return milestoneGroups.map(({ milestone, children }) => {
      const descendants = children.flatMap((child) => [
        child,
        ...(childMap.get(child.id) ?? []),
      ]);

      const total = descendants.length;
      const doneCount = descendants.filter((task) => task.status === "done").length;
      const activeCount = descendants.filter((task) => task.status !== "done").length;
      const progress = total ? Math.round((doneCount / total) * 100) : 0;

      const riskThreshold = addMinutes(new Date(), 24 * 60).getTime();
      let totalEstimate = 0;
      let riskCount = 0;
      let soonestDue = Number.POSITIVE_INFINITY;
      let nextDue: DPTask | undefined;

      for (const task of descendants) {
        totalEstimate += task.estimateMin ?? 0;
        if (!task.due) continue;
        const dueDate = parseISO(task.due);
        const dueTime = dueDate.getTime();
        if (!Number.isFinite(dueTime)) continue;
        if (dueTime < soonestDue) {
          soonestDue = dueTime;
          nextDue = task;
        }
        if (dueTime < riskThreshold) {
          riskCount += 1;
        }
      }

      return {
        milestone,
        directChildren: children,
        descendants,
        total,
        doneCount,
        activeCount,
        progress,
        totalEstimate,
        riskCount,
        nextDue,
      };
    });
  }, [milestoneGroups, childMap]);

  const timelineEntries = useMemo(
    () =>
      tasks
        .map((task) => {
          if (!task.due) return null;
          const dueDate = parseISO(task.due);
          if (!Number.isFinite(dueDate.getTime())) return null;
          return { task, dueDate };
        })
        .filter(
          (
            entry,
          ): entry is { task: DPTask; dueDate: Date } =>
            entry !== null,
        )
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
    [tasks],
  );

  const upNextTasks = useMemo(() => {
    const scheduledIds = new Set(todayPlan.map(({ task }) => task.id));
    return prioritizedQueue
      .filter((task) => !scheduledIds.has(task.id))
      .slice(0, 5);
  }, [prioritizedQueue, todayPlan]);

  const focusList = useMemo(
    () =>
      focusQueue
        .map((id) => tasks.find((task) => task.id === id))
        .filter((task): task is DPTask => Boolean(task)),
    [focusQueue, tasks],
  );

  const statusBuckets = useMemo(() => {
    const buckets: Record<TaskStatus, DPTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
    };

    for (const task of tasks) {
      buckets[task.status].push(task);
    }

    for (const status of statusOrder) {
      buckets[status].sort((a, b) => {
        const ad = a.due ? parseISO(a.due).getTime() : Infinity;
        const bd = b.due ? parseISO(b.due).getTime() : Infinity;
        return ad - bd;
      });
    }

    return buckets;
  }, [tasks]);

  const commits: { id: string; msg: string; time: string }[] = [];

  return (
    <div
      className="min-h-screen w-full p-6 text-slate-900 transition-colors duration-300 dark:text-slate-100 md:p-10"
      style={{ backgroundColor: "hsl(var(--background))" }}
    >
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="flex flex-col gap-6 pb-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
              <LayoutGrid className="h-7 w-7" /> DreamPlanner
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Fast planner • Notion for docs • ClickUp/GitHub data • AI scheduling soon™
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            {/* actions row (log out + theme) */}
            <div className="flex items-center gap-2 md:order-2">
              <form method="POST" action="/api/auth/logout">
                <Button variant="secondary" size="sm" aria-label="Log out">Log out</Button>
              </form>
              <ThemeToggle />
            </div>

            {/* search + sort */}
            <div className="flex w-full items-center gap-2 md:w-80 md:order-1">
              <form role="search" className="flex w-full items-center gap-2">
                <Input
                  placeholder="Search tasks or tags…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search tasks or tags"
                  className="w-full"
                />
                <Select value={sort} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-36" aria-label="Sort tasks">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Due date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="alpha">A–Z</SelectItem>
                  </SelectContent>
                </Select>
              </form>
            </div>
          </div>
        </header>

        {isLoading && (
          <Card className="relative overflow-hidden border-amber-300/50 text-amber-700 dark:border-amber-400/40 dark:text-amber-200">
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-100/40 via-transparent to-transparent dark:from-amber-500/10" />
            <CardContent className="relative z-10 p-4 text-sm text-amber-700 dark:text-amber-300">
              Pulling tasks from ClickUp…
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="relative overflow-hidden border-red-300/60 text-red-700 dark:border-red-500/45 dark:text-red-300">
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-red-100/35 via-transparent to-transparent dark:from-red-500/10" />
            <CardContent className="relative z-10 p-4 text-sm text-red-700 dark:text-red-300">
              Failed to fetch tasks. Check your <code>.env.local</code> and reload.
            </CardContent>
          </Card>
        )}

        <Card className="card-ghost border border-white/40 dark:border-white/5">
          <CardContent className="p-4 md:p-6">
            <div className="grid gap-5 md:grid-cols-4">
              <div className="md:col-span-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <ListChecks className="h-5 w-5" />
                    <span className="font-medium">Overall Progress</span>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{progressOverall}%</span>
                </div>
                <Progress className="mt-2" value={progressOverall} />
              </div>
              <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Checkbox
                  checked={showOnlyAtRisk}
                  onCheckedChange={(value) => setShowOnlyAtRisk(Boolean(value))}
                />
                <AlertTriangle className="h-4 w-4" />
                Show due &lt; 24h
              </label>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex-wrap gap-3 pb-1">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-6">
            {filteredMilestones.length ? (
              <div className="space-y-8">
                {filteredMilestones.map(({ milestone, tasks }) => {
                  const milestoneDue = milestone.due
                    ? format(parseISO(milestone.due), "MMM d, HH:mm")
                    : null;

                  return (
                    <section
                      key={milestone.id}
                      className="glass-panel space-y-4 rounded-lg p-5"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <TaskIdBadge id={milestone.id} />
                          <span className="text-lg font-semibold">
                            {milestone.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                          {milestoneDue ? (
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="h-4 w-4" />
                              {milestoneDue}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1.5">
                            <ListChecks className="h-4 w-4" />
                            {tasks.length} active
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {tasks.map(({ task, subtasks, allSubtasks }) => {
                          const hasSubtasks = allSubtasks.length > 0;
                          const isExpanded = hasSubtasks ? Boolean(expandedTasks[task.id]) : false;
                          const isFocused = focusSet.has(task.id);
                          const estimateLabel = formatMinutesLabel(task.estimateMin);
                          const taskDueLabel = task.due ? format(parseISO(task.due), "MMM d, HH:mm") : null;

                          if (!hasSubtasks) {
                            const progressValue = Math.max(0, Math.min(100, Math.round(task.progress ?? 0)));

                            return (
                              <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                              >
                                <Card
                                  className={cn(
                                    "h-full border border-white/50 transition hover:border-pink-300/70 hover:shadow-[0_18px_40px_rgba(236,72,153,0.18)] dark:border-white/10 dark:hover:border-pink-400/50",
                                    isFocused && "border-pink-500/60 shadow-[0_14px_32px_rgba(236,72,153,0.28)]",
                                  )}
                                >
                                  <CardHeader className="pb-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="flex min-w-0 flex-col gap-1">
                                        <TaskIdBadge id={task.id} className="w-fit" />
                                        <CardTitle className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100">
                                          {task.title}
                                        </CardTitle>
                                      </div>
                                      <div className="flex flex-wrap items-center justify-end gap-2">
                                        {isFocused ? (
                                          <Badge variant="secondary" className="bg-pink-500/20 text-pink-700 shadow-sm dark:bg-pink-500/20 dark:text-pink-100">
                                            Planned
                                          </Badge>
                                        ) : null}
                                        <Pill className={`${prioHue[task.priority]} capitalize`}>
                                          {task.priority}
                                        </Pill>
                                      </div>
                                    </div>
                                    <CardDescription className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                      {taskDueLabel ? (
                                        <span className="flex items-center gap-1">
                                          <CalendarDays className="h-3.5 w-3.5" /> {taskDueLabel}
                                        </span>
                                      ) : null}
                                      {estimateLabel ? (
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5" /> {estimateLabel}
                                        </span>
                                      ) : null}
                                      <Badge variant="outline">{statusLabel[task.status]}</Badge>
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="space-y-4">
                                    {task.tags && task.tags.length ? (
                                      <div className="flex flex-wrap gap-1">
                                        {task.tags.map((tag) => (
                                          <Badge key={tag} variant="secondary">
                                            #{tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div>
                                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                        <span>Progress</span>
                                        <span>{progressValue}%</span>
                                      </div>
                                      <Progress value={progressValue} className="mt-1" />
                                    </div>
                                    {task.deps?.length ? (
                                      <div className="text-xs text-slate-600 dark:text-slate-400">
                                        Deps: {task.deps.join(", ")}
                                      </div>
                                    ) : null}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {task.url ? (
                                        <Button size="sm" variant="outline" asChild>
                                          <a href={task.url} target="_blank" rel="noopener noreferrer">
                                            Open in ClickUp
                                          </a>
                                        </Button>
                                      ) : (
                                        <Button size="sm" variant="outline">
                                          Open
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant={isFocused ? "default" : "secondary"}
                                        onClick={() => toggleFocusTask(task.id)}
                                        aria-pressed={isFocused}
                                      >
                                        {isFocused ? "Planned" : "Plan today"}
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          }

                          const totalSubtasks = allSubtasks.length;
                          const doneSubtasks = allSubtasks.filter((sub) => sub.status === "done").length;
                          const inFlightSubtasks = allSubtasks.filter((sub) => sub.status === "in_progress").length;
                          const reviewSubtasks = allSubtasks.filter((sub) => sub.status === "review").length;
                          const todoSubtasks = totalSubtasks - doneSubtasks - inFlightSubtasks - reviewSubtasks;
                          const aggregatedProgress = Math.round((doneSubtasks / totalSubtasks) * 100);
                          const totalEstimateMinutes = allSubtasks.reduce(
                            (acc, sub) => acc + (sub.estimateMin ?? 0),
                            0,
                          );
                          const aggregateEstimateLabel = formatMinutesLabel(totalEstimateMinutes);
                          const nextDueDate = allSubtasks
                            .map((sub) => (sub.due ? parseISO(sub.due) : null))
                            .filter((date): date is Date => !!date && Number.isFinite(date.getTime()))
                            .sort((a, b) => a.getTime() - b.getTime())[0];
                          const nextDueLabel = nextDueDate
                            ? `${format(nextDueDate, "MMM d")} • ${format(nextDueDate, "HH:mm")}`
                            : null;
                          const blockedCount = allSubtasks.filter((sub) => (sub.deps?.length ?? 0) > 0).length;

                          return (
                            <motion.div
                              key={task.id}
                              layout
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                              <Card
                                className={cn(
                                  "group relative h-full overflow-hidden border border-pink-500/30 shadow-[0_18px_45px_rgba(15,23,42,0.12)] transition-all hover:border-pink-400/45 hover:shadow-[0_20px_54px_rgba(236,72,153,0.2)] dark:border-pink-400/30",
                                  isFocused && "border-pink-400/60 shadow-[0_22px_60px_rgba(236,72,153,0.25)]",
                                )}
                              >
                                <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/40 to-transparent" />
                                <CardHeader
                                  className="pb-4 transition-colors cursor-pointer hover:bg-pink-50/40 focus-visible:bg-pink-50/40 dark:hover:bg-pink-500/5 dark:focus-visible:bg-pink-500/5"
                                  onClick={(event) => {
                                    const target = event.target as HTMLElement;
                                    if (target.closest('[data-no-toggle]')) return;
                                    toggleTaskExpansion(task.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      toggleTaskExpansion(task.id);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                  aria-controls={`subtasks-${task.id}`}
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex min-w-0 flex-col gap-1">
                                      <TaskIdBadge id={task.id} className="w-fit" />
                                      <CardTitle className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
                                        {task.title}
                                      </CardTitle>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      {isFocused ? (
                                        <Badge
                                          variant="secondary"
                                          className="bg-pink-500/20 text-pink-700 shadow-sm dark:bg-pink-500/20 dark:text-pink-100"
                                          data-no-toggle
                                        >
                                          Planned
                                        </Badge>
                                      ) : null}
                                      <div className="flex items-center gap-1" data-no-toggle>
                                        <Pill className={`${prioHue[task.priority]} capitalize`}>
                                          {task.priority}
                                        </Pill>
                                        <Pill className="border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                                          {totalSubtasks} dependent{totalSubtasks === 1 ? "" : "s"}
                                        </Pill>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleTaskExpansion(task.id)}
                                        aria-expanded={isExpanded}
                                        aria-controls={`subtasks-${task.id}`}
                                        aria-label={isExpanded ? "Hide subtasks" : "Show subtasks"}
                                        className="glass-tile inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:border-pink-400/70 hover:text-pink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:border-pink-400/60 dark:hover:text-pink-100"
                                        data-no-toggle
                                      >
                                        <motion.span
                                          animate={{ rotate: isExpanded ? 90 : 0 }}
                                          transition={{ duration: 0.2, ease: "easeOut" }}
                                          className="inline-flex"
                                        >
                                          <ChevronRight className="h-4 w-4" />
                                        </motion.span>
                                      </button>
                                    </div>
                                  </div>
                                  <CardDescription className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <ListChecks className="h-3.5 w-3.5" /> {doneSubtasks}/{totalSubtasks} complete
                                    </span>
                                    {nextDueLabel ? (
                                      <span className="flex items-center gap-1">
                                        <CalendarDays className="h-3.5 w-3.5" /> {nextDueLabel}
                                      </span>
                                    ) : null}
                                    {aggregateEstimateLabel ? (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> {aggregateEstimateLabel}
                                      </span>
                                    ) : null}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px] md:items-center">
                                    <div>
                                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                        <span>{doneSubtasks} of {totalSubtasks} closed</span>
                                        <span>{aggregatedProgress}%</span>
                                      </div>
                                      <Progress value={aggregatedProgress} className="mt-1 h-2 rounded-full" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                                      <div className="glass-tile rounded-md p-2 text-center">
                                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{inFlightSubtasks}</p>
                                        <p>In progress</p>
                                      </div>
                                      <div className="glass-tile rounded-md p-2 text-center">
                                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{reviewSubtasks}</p>
                                        <p>Review</p>
                                      </div>
                                      <div className="glass-tile rounded-md p-2 text-center">
                                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{todoSubtasks}</p>
                                        <p>Queued</p>
                                      </div>
                                      <div className="glass-tile rounded-md p-2 text-center">
                                        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{blockedCount}</p>
                                        <p>Blocked</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                    {aggregateEstimateLabel ? (
                                      <Pill className="border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                                        <Clock className="h-3 w-3" /> Total {aggregateEstimateLabel}
                                      </Pill>
                                    ) : null}
                                    {nextDueLabel ? (
                                      <Pill className="border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                                        <CalendarDays className="h-3 w-3" /> Next due {nextDueLabel}
                                      </Pill>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {task.url ? (
                                      <Button size="sm" variant="outline" asChild data-no-toggle>
                                        <a href={task.url} target="_blank" rel="noopener noreferrer">
                                          Open in ClickUp
                                        </a>
                                      </Button>
                                    ) : (
                                      <Button size="sm" variant="outline" data-no-toggle>
                                        Open
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant={isFocused ? "default" : "secondary"}
                                      onClick={() => toggleFocusTask(task.id)}
                                      aria-pressed={isFocused}
                                      data-no-toggle
                                    >
                                      {isFocused ? "Planned" : "Plan today"}
                                    </Button>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {isExpanded ? (
                                      <motion.div
                                        id={`subtasks-${task.id}`}
                                        key={`subtasks-${task.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                        className="space-y-3 overflow-hidden pl-1 pt-2"
                                      >
                                        {subtasks.map((subtask, index) => {
                                          const subtaskEstimate = formatMinutesLabel(subtask.estimateMin);
                                          return (
                                            <motion.div
                                              key={subtask.id}
                                              initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                              exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                              transition={{ duration: 0.18, ease: "easeOut", delay: index * 0.03 }}
                                              className="glass-tile relative overflow-hidden rounded-lg p-3 text-sm transition-shadow hover:shadow-[0_12px_30px_-12px_rgba(15,23,42,0.25)]"
                                            >
                                              <span
                                                aria-hidden
                                                className="pointer-events-none absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-pink-400 via-cyan-400 to-transparent"
                                              />
                                              <div className="flex items-start justify-between gap-2">
                                                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                                                  {subtask.title}
                                                </span>
                                                <Badge variant="outline">{statusLabel[subtask.status]}</Badge>
                                              </div>
                                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                {subtask.due ? (
                                                  <span className="flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" />
                                                    {format(parseISO(subtask.due), "MMM d")}
                                                  </span>
                                                ) : null}
                                                {subtaskEstimate ? (
                                                  <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {subtaskEstimate}
                                                  </span>
                                                ) : null}
                                                {(subtask.deps?.length ?? 0) > 0 ? (
                                                  <span className="flex items-center gap-1">
                                                    <GitCommit className="h-3 w-3" />
                                                    {subtask.deps?.length ?? 0} deps
                                                  </span>
                                                ) : null}
                                              </div>
                                            </motion.div>
                                          );
                                        })}
                                      </motion.div>
                                    ) : null}
                                  </AnimatePresence>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <Card className="border-white/50 dark:border-white/10">
                <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-400">
                  No milestone tasks match your filters. Assign tasks to a milestone or adjust the search/risk toggles to see more work.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4">
            {milestoneSummaries.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {milestoneSummaries.map((summary) => {
                  const milestoneDue = summary.milestone.due
                    ? format(parseISO(summary.milestone.due), "MMM d, HH:mm")
                    : null;
                  const nextDueLabel = summary.nextDue?.due
                    ? format(parseISO(summary.nextDue.due), "MMM d, HH:mm")
                    : null;
                  const subtaskCount =
                    summary.descendants.length - summary.directChildren.length;
                  const estimateLabel = formatMinutesLabel(summary.totalEstimate);

                  return (
                    <Card
                      key={summary.milestone.id}
                      className="border-slate-200/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                            {summary.milestone.title}
                          </CardTitle>
                          <TaskIdBadge id={summary.milestone.id} />
                        </div>
                        <CardDescription className="flex flex-wrap items-center gap-3 text-xs md:text-sm">
                          {milestoneDue ? (
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <CalendarDays className="h-4 w-4" />
                              {milestoneDue}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">No due date</span>
                          )}
                          {estimateLabel ? (
                            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                              <Clock className="h-4 w-4" />
                              {estimateLabel}
                            </span>
                          ) : null}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>
                              {summary.total} tasks
                              {subtaskCount > 0
                                ? ` • ${subtaskCount} subtasks`
                                : ""}
                            </span>
                            <span>{summary.progress}%</span>
                          </div>
                          <Progress value={summary.progress} className="mt-2" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                          <div className="rounded-md border border-slate-200/70 bg-slate-50/40 p-2 dark:border-slate-800/60 dark:bg-slate-900/40">
                            <span className="block text-[11px] uppercase text-slate-500 dark:text-slate-400">
                              Active
                            </span>
                            <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                              {summary.activeCount}
                            </span>
                          </div>
                          <div className="rounded-md border border-slate-200/70 bg-slate-50/40 p-2 dark:border-slate-800/60 dark:bg-slate-900/40">
                            <span className="block text-[11px] uppercase text-slate-500 dark:text-slate-400">
                              Completed
                            </span>
                            <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                              {summary.doneCount}
                            </span>
                          </div>
                          <div className="rounded-md border border-slate-200/70 bg-slate-50/40 p-2 dark:border-slate-800/60 dark:bg-slate-900/40">
                            <span className="block text-[11px] uppercase text-slate-500 dark:text-slate-400">
                              At Risk
                            </span>
                            <span
                              className={`text-base font-semibold ${summary.riskCount
                                ? "text-amber-600"
                                : "text-slate-700 dark:text-slate-300"
                                }`}
                            >
                              {summary.riskCount}
                            </span>
                          </div>
                          <div className="rounded-md border border-slate-200/70 bg-slate-50/40 p-2 dark:border-slate-800/60 dark:bg-slate-900/40">
                            <span className="block text-[11px] uppercase text-slate-500 dark:text-slate-400">
                              Next Due
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {nextDueLabel ?? "None"}
                            </span>
                          </div>
                        </div>

                        {summary.directChildren.slice(0, 4).map((child) => {
                          const childDue = child.due
                            ? format(parseISO(child.due), "MMM d")
                            : null;
                          const estimate = formatMinutesLabel(child.estimateMin);
                          return (
                            <div
                              key={child.id}
                      className="glass-tile flex items-start justify-between gap-3 rounded-md p-2"
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {child.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {childDue ? (
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {childDue}
                                    </span>
                                  ) : null}
                                  {estimate ? (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {estimate}
                                    </span>
                                  ) : null}
                                  {child.tags?.slice(0, 1).map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                                    >
                                      #{tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <Pill
                                className={`${prioHue[child.priority]} whitespace-nowrap capitalize`}
                              >
                                {child.priority}
                              </Pill>
                            </div>
                          );
                        })}
                        {summary.directChildren.length > 4 ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            +{summary.directChildren.length - 4} more tracked tasks
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-white/50 dark:border-white/10">
                <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-400">
                  No milestones with assigned tasks yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            {todayPlan.length ? (
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <Card className="border-white/40 dark:border-white/10">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      Focus Blocks
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                      {scheduleHeadline}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {todayPlan.map(({ task, from, to }, index) => {
                      const startLabel = format(from, "HH:mm");
                      const endLabel = format(to, "HH:mm");
                      const slotMinutes = Math.max(
                        0,
                        Math.round((to.getTime() - from.getTime()) / 60000),
                      );
                      const durationLabel =
                        formatMinutesLabel(task.estimateMin ?? slotMinutes) ??
                        formatMinutesLabel(slotMinutes) ??
                        `${slotMinutes}m`;
                      const isFocused = focusSet.has(task.id);

                      return (
                        <div
                          key={`${task.id}-${index}`}
                          className={cn(
                            "glass-panel space-y-3 rounded-lg p-3 transition",
                            isFocused &&
                            "border-pink-500/50 shadow-[0_10px_24px_rgba(236,72,153,0.2)]",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                              <Clock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                              {startLabel} – {endLabel}
                            </div>
                            <Pill className={`${prioHue[task.priority]} whitespace-nowrap capitalize`}>
                              {task.priority}
                            </Pill>
                          </div>
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <TaskIdBadge id={task.id} />
                              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                {task.title}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>{durationLabel}</span>
                              {task.due ? (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />
                                  {format(parseISO(task.due), "MMM d, HH:mm")}
                                </span>
                              ) : null}
                              {task.deps?.length ? (
                                <span>Deps: {task.deps.join(", ")}</span>
                              ) : null}
                            </div>
                          </div>
                          {task.tags?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {task.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                <div className="space-y-4">
                  <Card className="border-white/40 dark:border-white/10">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Focus Queue
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                        Tasks you&apos;ve pinned for today
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {focusList.length ? (
                        <ol className="space-y-2">
                          {focusList.map((task, index) => (
                            <li
                              key={task.id}
                              className="glass-tile flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {index + 1}.
                                </span>
                                <TaskIdBadge id={task.id} />
                                <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {task.title}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleFocusTask(task.id)}
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Pick a few tasks in the Tasks tab to build a focus queue.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-white/40 dark:border-white/10">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Up Next
                      </CardTitle>
                      <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                        Auto-prioritized from remaining queue
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {upNextTasks.length ? (
                        upNextTasks.map((task) => {
                          const dueLabel = task.due
                            ? format(parseISO(task.due), "MMM d")
                            : null;
                          const estimateLabel = formatMinutesLabel(task.estimateMin);
                          const isFocused = focusSet.has(task.id);
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "glass-tile flex items-start justify-between gap-3 rounded-md p-3",
                                isFocused && "border-pink-500/60",
                              )}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <TaskIdBadge id={task.id} />
                                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {task.title}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {dueLabel ? (
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {dueLabel}
                                    </span>
                                  ) : null}
                                  {estimateLabel ? <span>{estimateLabel}</span> : null}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={isFocused ? "default" : "secondary"}
                                onClick={() => toggleFocusTask(task.id)}
                                aria-pressed={isFocused}
                              >
                                {isFocused ? "Planned" : "Plan today"}
                              </Button>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          All priority work is already on today&apos;s plan. Nice!
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card className="border-white/50 dark:border-white/10">
                <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-400">
                  No focus blocks scheduled yet. Add tasks to a milestone and give them due dates to generate a draft day plan.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            {timelineEntries.length ? (
              <Card className="border-white/40 dark:border-white/10">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Delivery Timeline
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                    Ordered by due date across all milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-3 top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-6 pl-8">
                      {timelineEntries.map(({ task, dueDate }, index) => {
                        const dateLabel = format(dueDate, "EEE, MMM d");
                        const timeLabel = format(dueDate, "HH:mm");
                        return (
                          <div key={`${task.id}-${index}`} className="relative">
                            <span className="glass-tile absolute -left-8 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {task.priority.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="glass-panel rounded-lg p-3">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {dateLabel}
                                </span>
                                <span>{timeLabel}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <TaskIdBadge id={task.id} />
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {task.title}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <Pill className={`${prioHue[task.priority]} lowercase`}>
                                  {task.priority}
                                </Pill>
                                <Badge variant="outline">
                                  {statusLabel[task.status]}
                                </Badge>
                                {task.estimateMin ? (
                                  <span>{formatMinutesLabel(task.estimateMin)}</span>
                                ) : null}
                                {task.tags?.slice(0, 1).map((tag) => (
                                  <Badge key={tag} variant="secondary">
                                    #{tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-white/50 dark:border-white/10">
                <CardContent className="p-6 text-sm text-slate-600 dark:text-slate-400">
                  Add due dates to tasks to visualize the timeline.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent
            value="activity"
            className="grid gap-4 lg:grid-cols-[2fr_1fr]"
          >
            <Card className="border-white/40 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Status Overview
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                  Snapshot of ClickUp workflow buckets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusOrder.map((status) => {
                  const bucket = statusBuckets[status];
                  if (!bucket.length) {
                    return (
                      <div
                        key={status}
                        className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
                      >
                        {statusLabel[status]} is empty.
                      </div>
                    );
                  }

                  return (
                    <div
                      key={status}
                      className="glass-panel space-y-2 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {statusLabel[status]}
                        </span>
                        <Badge variant="outline">{bucket.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {bucket.slice(0, 3).map((task) => {
                          const dueLabel = task.due
                            ? format(parseISO(task.due), "MMM d")
                            : null;
                          return (
                            <div
                              key={task.id}
                              className="flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {task.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  {dueLabel ? (
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {dueLabel}
                                    </span>
                                  ) : null}
                                  {task.estimateMin ? (
                                    <span>{formatMinutesLabel(task.estimateMin)}</span>
                                  ) : null}
                                </div>
                              </div>
                              <Pill
                                className={`${prioHue[task.priority]} whitespace-nowrap capitalize`}
                              >
                                {task.priority}
                              </Pill>
                            </div>
                          );
                        })}
                      </div>
                      {bucket.length > 3 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          +{bucket.length - 3} more
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card className="border-white/40 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
                  Sync code, docs, and task updates here
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {commits.length ? (
                  commits.map((entry) => (
                    <div
                      key={entry.id}
                      className="glass-tile flex items-start gap-3 rounded-md p-3"
                    >
                      <GitCommit className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {entry.msg}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{entry.time}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    No recent repo updates yet. Connect your GitHub workflow to surface commits and deploys.
                  </div>
                )}
                <Button size="sm" variant="secondary" className="w-full">
                  Connect Integrations
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="pt-4 text-xs text-slate-500 dark:text-slate-400">
          Pro tip: swap the ClickUp mock with live data via React Query, then wire “Block on Calendar” to an ICS route.
        </footer>
      </div>
    </div>
  );
}
