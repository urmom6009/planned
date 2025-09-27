"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format, addMinutes, isBefore, parseISO } from "date-fns";
import ThemeToggle from "@/components/ThemeToggle";

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
  ChevronDown,
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

const isSortOption = (value: string): value is SortOption =>
  sortOptions.includes(value as SortOption);

const prioHue: Record<Priority, string> = {
  urgent: "bg-pink-500/15 text-pink-300 border-pink-500/40",
  high:   "bg-amber-500/15 text-amber-300 border-amber-500/40",
  medium: "bg-cyan-400/15 text-cyan-300 border-cyan-400/40",
  low:    "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "To-Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

function minutesToBlocks(min?: number) {
  if (!min) return 0;
  return Math.max(1, Math.round(min / 30));
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

const pct = (n?: number) => Math.max(0, Math.min(100, Math.round(n ?? 0)));

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

export default function DreamPlannerApp() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("due");
  const [tab, setTab] = useState("tasks");
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const handleSortChange = (value: string) => {
    setSort(isSortOption(value) ? value : "due");
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const { data, isLoading, error } = useQuery<ClickUpTasksResponse>({
    queryKey: ["clickup_tasks"],
    queryFn: async (): Promise<ClickUpTasksResponse> => {
      const res = await fetch("/api/clickup/tasks");
      if (!res.ok) throw new Error(`API ${res.status}`);
      const payload = (await res.json()) as ClickUpTasksResponse;
      return payload;
    },
    refetchInterval: 60_000,
  });

  const tasks: DPTask[] = useMemo(() => {
    if (!data?.tasks) return [];
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

    const matchesFilters = (task: DPTask) => matchesQuery(task) && matchesRisk(task);

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
            const subtasks = childMap.get(child.id) ?? [];
            const matchingSubtasks = subtasks
              .filter(matchesFilters)
              .sort(compareTasks);

            if (!matchesFilters(child) && matchingSubtasks.length === 0) {
              return null;
            }

            return {
              task: child,
              subtasks: matchingSubtasks,
            };
          })
          .filter(
            (entry): entry is { task: DPTask; subtasks: DPTask[] } => entry !== null,
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
          tasks: { task: DPTask; subtasks: DPTask[] }[];
        } => group !== null,
      );
  }, [milestoneGroups, childMap, queryLower, showOnlyAtRisk, sort]);

  const actionableQueue = useMemo(
    () => filteredMilestones.flatMap((group) => group.tasks.map(({ task }) => task)),
    [filteredMilestones],
  );

  const todayPlan = useMemo(
    () => suggestDayPlan(actionableQueue.slice(0, 8)),
    [actionableQueue],
  );

  const progressOverall = useMemo(() => {
    const vals = tasks.map((t) => t.progress ?? 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length));
  }, [tasks]);

  const commits: { id: string; msg: string; time: string }[] = [];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-6 text-slate-900 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-bold tracking-tight md:text-4xl neon">
              <LayoutGrid className="h-7 w-7" /> DreamPlanner
            </h1>
            <p className="text-sm text-slate-600">
              Fast planner • Notion for docs • ClickUp/GitHub data • AI scheduling soon™
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <ThemeToggle className="self-end md:self-auto" />
            <div className="flex w-full items-center gap-2 md:w-80">
              <Input
                placeholder="Search tasks or tags…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due">Due date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="alpha">A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        {isLoading && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 text-sm text-amber-700">
              Pulling tasks from ClickUp…
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">
              Failed to fetch tasks. Check your <code>.env.local</code> and reload.
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <ListChecks className="h-5 w-5" />
                    <span className="font-medium">Overall Progress</span>
                  </div>
                  <span className="text-sm text-slate-500">{progressOverall}%</span>
                </div>
                <Progress className="mt-2" value={progressOverall} />
              </div>
              <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-slate-700">
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
          <TabsList className="flex-wrap">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {filteredMilestones.length ? (
              <div className="space-y-6">
                {filteredMilestones.map(({ milestone, tasks }) => {
                  const milestoneDue = milestone.due
                    ? format(parseISO(milestone.due), "MMM d, HH:mm")
                    : null;

                  return (
                    <section
                      key={milestone.id}
                      className="space-y-3 rounded-lg border border-slate-200/70 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Badge variant="outline">{milestone.id}</Badge>
                          <span className="text-lg font-semibold">{milestone.title}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
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
                        {tasks.map(({ task, subtasks }) => {
                          const hasSubtasks = subtasks.length > 0;
                          const isExpanded = Boolean(expandedTasks[task.id]);

                          return (
                            <motion.div
                              key={task.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <Card className="h-full border-slate-200">
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <CardTitle className="text-base leading-snug">
                                      {task.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                      <Pill className={prioHue[task.priority]}>
                                        {task.priority}
                                      </Pill>
                                      {hasSubtasks ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleTaskExpansion(task.id)}
                                          aria-expanded={isExpanded}
                                          aria-controls={`subtasks-${task.id}`}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"
                                        >
                                          {isExpanded ? (
                                            <ChevronDown className="h-4 w-4" />
                                          ) : (
                                            <ChevronRight className="h-4 w-4" />
                                          )}
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                    <Pill className="bg-slate-100 border-slate-300">
                                      {statusLabel[task.status]}
                                    </Pill>
                                    {task.due ? (
                                      <Pill className="bg-slate-100 border-slate-300">
                                        <CalendarDays className="h-3 w-3" /> {" "}
                                        {format(parseISO(task.due), "MMM d, HH:mm")}
                                      </Pill>
                                    ) : null}
                                    {task.estimateMin ? (
                                      <Pill className="bg-slate-100 border-slate-300">
                                        <Clock className="h-3 w-3" /> {task.estimateMin}m
                                      </Pill>
                                    ) : null}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
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
                                    <div className="flex items-center justify-between text-xs text-slate-600">
                                      <span>Progress</span>
                                      <span>{pct(task.progress)}%</span>
                                    </div>
                                    <Progress value={pct(task.progress)} className="mt-1" />
                                  </div>
                                  {task.deps?.length ? (
                                    <div className="text-xs text-slate-600">
                                      Deps: {task.deps.join(", ")}
                                    </div>
                                  ) : null}
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" variant="secondary">
                                      Open
                                    </Button>
                                    <Button size="sm">Start</Button>
                                  </div>
                                  {hasSubtasks && isExpanded ? (
                                    <div
                                      id={`subtasks-${task.id}`}
                                      className="space-y-2 rounded-md border border-slate-200 bg-white/90 p-2 text-xs text-slate-600"
                                    >
                                      {subtasks.map((subtask) => (
                                        <div key={subtask.id} className="space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="truncate font-medium text-slate-700">
                                              {subtask.title}
                                            </span>
                                            <Badge variant="outline">
                                              {statusLabel[subtask.status]}
                                            </Badge>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            {subtask.due ? (
                                              <span className="flex items-center gap-1">
                                                <CalendarDays className="h-3 w-3" />
                                                {format(parseISO(subtask.due), "MMM d")}
                                              </span>
                                            ) : null}
                                            {subtask.estimateMin ? (
                                              <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {subtask.estimateMin}m
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
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
              <Card className="border-slate-200">
                <CardContent className="p-6 text-sm text-slate-600">
                  No milestone tasks match your filters. Assign tasks to a milestone or adjust the search/risk toggles to see more work.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4">
            {milestoneGroups.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {milestoneGroups.map(({ milestone, children }) => {
                  const averageProgress = pct(
                    children.length
                      ? children.reduce(
                          (sum, child) => sum + (child.progress ?? 0),
                          0,
                        ) / children.length
                      : 0,
                  );

                  return (
                    <Card key={milestone.id} className="border-slate-200">
                      <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-lg">{milestone.title}</CardTitle>
                          <Badge variant="secondary">{children.length} tasks</Badge>
                        </div>
                        {milestone.due ? (
                          <CardDescription className="flex items-center gap-2 text-sm">
                            <CalendarDays className="h-4 w-4" />
                            Due {format(parseISO(milestone.due), "MMM d, HH:mm")}
                          </CardDescription>
                        ) : null}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          {children.map((child) => (
                            <div
                              key={child.id}
                              className="flex items-center justify-between rounded-lg border px-2 py-1 text-sm"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Badge variant="outline">{child.id}</Badge>
                                <span className="truncate">{child.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{statusLabel[child.status]}</span>
                                {child.due ? (
                                  <span>{format(parseISO(child.due), "MMM d")}</span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                        {children.length ? (
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span>Avg progress</span>
                              <span>{averageProgress}%</span>
                            </div>
                            <Progress value={averageProgress} className="mt-1" />
                          </div>
                        ) : null}
                        <Button variant="secondary" size="sm">
                          View timeline
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-slate-200">
                <CardContent className="p-6 text-sm text-slate-600">
                  No parent/child relationships detected. Link subtasks in ClickUp to see milestone roll-ups here.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" /> Suggested Plan (Greedy)
                </CardTitle>
                <CardDescription>
                  Generates 30-minute blocks from now, respecting dependencies.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!todayPlan.length && (
                  <div className="text-sm text-slate-600">
                    No runnable tasks. Mark deps done or adjust ordering.
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {todayPlan.map(({ task, from, to }) => (
                    <div key={task.id} className="rounded-xl border bg-white/60 p-3">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {format(from, "HH:mm")} – {format(to, "HH:mm")}
                        </span>
                        <span className="ml-2 rounded-full px-2 py-0.5 capitalize text-slate-600">
                          {task.priority}
                        </span>
                      </div>
                      <div className="mt-1 font-medium text-slate-800">
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-600">
                        {minutesToBlocks(task.estimateMin)} block(s) · {task.estimateMin ?? 60} min
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button>Block on Calendar</Button>
                  <Button variant="secondary">Rebalance</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-5 w-5" /> Timeline (7-day Gantt-lite)
                </CardTitle>
                <CardDescription>
                  Scrollable Gantt; bars from due dates + estimates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const start = new Date();
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                  const span = end.getTime() - start.getTime();
                  let cursor = start.getTime() + 60 * 60 * 1000;

                  const rows = tasks.map((task) => {
                    const est = (task.estimateMin ?? 60) * 60 * 1000;
                    let tEnd = task.due ? parseISO(task.due).getTime() : cursor + est;
                    let tStart = tEnd - est;
                    if (!task.due) {
                      tStart = cursor;
                      tEnd = cursor + est;
                      cursor = tEnd + 30 * 60 * 1000;
                    }
                    const clampedStart = Math.max(start.getTime(), tStart);
                    const clampedEnd = Math.min(end.getTime(), tEnd);
                    const leftPct = ((clampedStart - start.getTime()) / span) * 100;
                    const widthPct = Math.max(
                      0.5,
                      ((clampedEnd - clampedStart) / span) * 100,
                    );
                    return { task, leftPct, widthPct };
                  });

                  return (
                    <div className="w-full overflow-x-auto">
                      <div className="min-w-[900px]">
                        <div className="relative h-8 border-b text-[10px] text-slate-600">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              className="absolute inset-y-0 border-l border-slate-200"
                              style={{ left: `${(i / 7) * 100}%`, width: 0 }}
                            >
                              <div className="absolute top-1 -translate-x-1/2">
                                {format(
                                  new Date(start.getTime() + i * 24 * 60 * 60 * 1000),
                                  "MMM d",
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="divide-y">
                          {rows.map(({ task, leftPct, widthPct }) => (
                            <div key={task.id} className="relative h-12">
                              <div className="absolute inset-y-0 left-0 flex w-56 items-center truncate px-2 text-xs text-slate-700">
                                <span className="mr-2">
                                  <Badge variant="outline">{task.id}</Badge>
                                </span>
                                {task.title}
                              </div>
                              <div className="absolute inset-y-0 left-56 right-0">
                                <div className="relative h-full">
                                  <div
                                    className="absolute top-2 flex h-7 items-center rounded-lg border bg-white px-2 text-xs font-medium shadow-sm"
                                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                  >
                                    <span className="mr-2 h-2 w-2 rounded-full bg-slate-500" />
                                    {format(
                                      task.due ? parseISO(task.due) : new Date(),
                                      "MMM d HH:mm",
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitCommit className="h-5 w-5" /> Recent Commits
                </CardTitle>
                <CardDescription>
                  Commits using syntax #&lt;taskID&gt;[Status] attach to tasks automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {commits.map((commit) => (
                  <div
                    key={commit.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{commit.id}</Badge>
                      <span className="font-mono">{commit.msg}</span>
                    </div>
                    <div className="text-slate-500">
                      {format(parseISO(commit.time), "MMM d, HH:mm")}
                    </div>
                  </div>
                ))}
                {!commits.length && (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                    Hook up your repo to surface ClickUp-linked commits here.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="pt-4 text-xs text-slate-500">
          Pro tip: swap the ClickUp mock with live data via React Query, then wire “Block on Calendar” to an ICS route.
        </footer>
      </div>
    </div>
  );
}
