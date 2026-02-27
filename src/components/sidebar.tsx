"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  Film,
  FolderOpen,
  Plus,
  Settings,
  Trash2,
  Layers,
  Image,
  Pencil,
  GripVertical,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { SettingsDialog } from "@/components/settings-dialog";
import { cn } from "@/lib/utils";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_WIDTH_KEY = "sidebar-width";

type ImageVersion = {
  id: string;
  version: number;
  isActive: boolean;
};

type Shot = {
  id: string;
  shotName: string;
  alias: string | null;
  displayName: string;
  sortOrder: number;
};

type PromptVersion = {
  version: number;
  shots: Shot[];
};

type Scene = {
  id: string;
  projectId: string;
  name: string;
  alias: string | null;
  displayName: string;
  sortOrder: number;
  promptVersions: PromptVersion[];
};

type Project = {
  id: string;
  name: string;
  alias: string | null;
  displayName: string;
  scenes: Scene[];
};

function useSidebarWidth() {
  const [width, setWidth] = React.useState(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= SIDEBAR_MIN_WIDTH && parsed <= SIDEBAR_MAX_WIDTH) {
        return parsed;
      }
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });

  const saveWidth = React.useCallback((newWidth: number) => {
    setWidth(newWidth);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(newWidth));
  }, []);

  return { width, saveWidth };
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { width: sidebarWidth, saveWidth: setSidebarWidth } = useSidebarWidth();
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<HTMLDivElement>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set()
  );
  const [expandedScenes, setExpandedScenes] = React.useState<Set<string>>(
    new Set()
  );
  const [expandedVersions, setExpandedVersions] = React.useState<Set<string>>(
    new Set()
  );
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Handle resize
  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= SIDEBAR_MIN_WIDTH && newWidth <= SIDEBAR_MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const startResizing = React.useCallback(() => {
    setIsResizing(true);
  }, []);

  const fetchProjects = React.useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
    } catch {
      toast.error("加载项目列表失败");
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for sidebar refresh event from other components
  React.useEffect(() => {
    const handleRefresh = () => {
      fetchProjects();
    };
    window.addEventListener("sidebar:refresh", handleRefresh);
    return () => {
      window.removeEventListener("sidebar:refresh", handleRefresh);
    };
  }, [fetchProjects]);

  // Auto-expand the project that contains the active scene
  React.useEffect(() => {
    const match = pathname.match(/\/projects\/([^/]+)/);
    if (match) {
      setExpandedProjects((prev) => new Set(prev).add(match[1]));
    }
  }, [pathname]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const toggleScene = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const toggleVersion = (versionKey: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionKey)) {
        next.delete(versionKey);
      } else {
        next.add(versionKey);
      }
      return next;
    });
  };

  const handleCreateProject = async () => {
    const name = prompt("项目名称");
    if (!name?.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      await fetchProjects();
    } catch {
      toast.error("创建项目失败");
    }
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation();
    if (!confirm("确定删除该项目及其所有场景？")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete project");
      await fetchProjects();
      if (pathname.startsWith(`/projects/${projectId}`)) {
        router.push("/");
      }
    } catch {
      toast.error("删除项目失败");
    }
  };

  const handleCreateScene = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation();
    const name = prompt("场景名称");
    if (!name?.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create scene");
      const scene = await res.json();
      await fetchProjects();
      setExpandedProjects((prev) => new Set(prev).add(projectId));
      router.push(`/projects/${projectId}/scenes/${scene.id}`);
    } catch {
      toast.error("创建场景失败");
    }
  };

  const handleDeleteScene = async (
    e: React.MouseEvent,
    projectId: string,
    sceneId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确定删除该场景？")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete scene");
      await fetchProjects();
      if (pathname.includes(sceneId)) {
        router.push("/");
      }
    } catch {
      toast.error("删除场景失败");
    }
  };

  const handleRename = async (
    e: React.MouseEvent,
    type: "project" | "scene" | "shot",
    id: string,
    currentAlias: string | null,
    currentName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const newAlias = prompt("输入别名（留空则清除别名）:", currentAlias || "");
    if (newAlias === null) return; // cancelled
    try {
      const res = await fetch("/api/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, alias: newAlias }),
      });
      if (!res.ok) throw new Error("Rename failed");
      await fetchProjects();
    } catch {
      toast.error("重命名失败");
    }
  };

  const handleDeleteShot = async (
    e: React.MouseEvent,
    shotId: string,
    shotName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`确定删除分镜"${shotName}"？`)) return;
    try {
      const res = await fetch(`/api/shots/${shotId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete shot");
      await fetchProjects();
      // If we're on the shot detail page, navigate away
      if (pathname.includes(shotId)) {
        const sceneMatch = pathname.match(/\/scenes\/([^/]+)/);
        if (sceneMatch) {
          router.push(`/projects/${pathname.split('/')[2]}/scenes/${sceneMatch[1]}`);
        }
      }
    } catch {
      toast.error("删除分镜失败");
    }
  };

  const handleDeleteVersion = async (
    e: React.MouseEvent,
    projectId: string,
    sceneId: string,
    version: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`确定删除版本 v${version} 及其所有分镜？`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/scenes/${sceneId}/versions/${version}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete version");
      await fetchProjects();
      // If we're on this version's page, navigate to scene
      if (pathname.includes(sceneId)) {
        router.push(`/projects/${projectId}/scenes/${sceneId}`);
      }
    } catch {
      toast.error("删除版本失败");
    }
  };

  return (
    <div
      className="relative flex"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <div
        style={{ width: `${sidebarWidth}px`, minWidth: `${SIDEBAR_MIN_WIDTH}px`, maxWidth: `${SIDEBAR_MAX_WIDTH}px` }}
        className="transition-[width] duration-75 ease-out"
      >
        <Sidebar style={{ width: "100%" }} collapsible="none">
          <SidebarHeader>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-lg font-bold tracking-tight">Nano</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSettingsOpen(true)}>
                <Settings className="size-4" />
              </Button>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                <span>项目</span>
              </SidebarGroupLabel>
              <SidebarMenu>
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              return (
                <SidebarMenuItem key={project.id}>
                  {/* Project header with isolated group */}
                  <div className="group/project relative">
                    <SidebarMenuButton
                      onClick={() => toggleProject(project.id)}
                      tooltip={project.displayName}
                    >
                      <ChevronRight
                        className={`size-4 shrink-0 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      <FolderOpen className="size-4 shrink-0" />
                      <span className="truncate">{project.displayName}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={(e) => handleCreateScene(e, project.id)}
                      title="添加场景"
                    >
                      <Plus className="size-4" />
                    </SidebarMenuAction>
                    <button
                      onClick={(e) => handleRename(e, "project", project.id, project.alias, project.name)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 hidden rounded-md p-1 text-muted-foreground hover:text-foreground group-hover/project:block"
                      title="重命名"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteProject(e, project.id)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 hidden rounded-md p-1 text-muted-foreground hover:text-destructive group-hover/project:block"
                      title="删除项目"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {isExpanded && (
                    <SidebarMenuSub>
                      {project.scenes.length === 0 && (
                        <li className="px-2 py-1 text-xs text-muted-foreground">
                          暂无场景
                        </li>
                      )}
                      {project.scenes.map((scene) => {
                        const scenePath = `/projects/${project.id}/scenes/${scene.id}`;
                        const isActive = pathname === scenePath;
                        const isSceneExpanded = expandedScenes.has(scene.id);
                        return (
                          <SidebarMenuSubItem key={scene.id}>
                            {/* Scene header with isolated group */}
                            <div className="group/scene relative flex items-center w-full">
                              <button
                                onClick={() => toggleScene(scene.id)}
                                className="p-1 hover:bg-accent rounded-sm"
                                title="展开/收起"
                              >
                                <ChevronRight
                                  className={`size-4 shrink-0 transition-transform ${
                                    isSceneExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isActive}
                                className="flex-1"
                              >
                                <Link href={scenePath}>
                                  <Film className="size-4 shrink-0" />
                                  <span className="truncate">{scene.displayName}</span>
                                </Link>
                              </SidebarMenuSubButton>
                              <button
                                onClick={(e) => handleRename(e, "scene", scene.id, scene.alias, scene.name)}
                                className="absolute right-7 top-1.5 hidden rounded-md p-0.5 text-muted-foreground hover:text-foreground group-hover/scene:block"
                                title="重命名"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteScene(e, project.id, scene.id)}
                                className="absolute right-1 top-1.5 hidden rounded-md p-0.5 text-muted-foreground hover:text-destructive group-hover/scene:block"
                                title="删除场景"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                            {isSceneExpanded && scene.promptVersions.length > 0 && (
                              <SidebarMenuSub>
                                {scene.promptVersions.map((pv) => {
                                  const versionKey = `${scene.id}-v${pv.version}`;
                                  const isVersionExpanded = expandedVersions.has(versionKey);
                                  const versionPath = `/projects/${project.id}/scenes/${scene.id}?v=${pv.version}`;
                                  return (
                                    <SidebarMenuSubItem key={versionKey}>
                                      <div className="group/version relative flex items-center w-full">
                                        <button
                                          onClick={() => toggleVersion(versionKey)}
                                          className="p-1 hover:bg-accent rounded-sm"
                                          title="展开/收起"
                                        >
                                          <ChevronRight
                                            className={`size-3 shrink-0 transition-transform ${
                                              isVersionExpanded ? "rotate-90" : ""
                                            }`}
                                          />
                                        </button>
                                        <SidebarMenuSubButton
                                          asChild
                                          className="flex-1"
                                        >
                                          <Link href={versionPath}>
                                            <Layers className="size-4 shrink-0" />
                                            <span className="truncate">v{pv.version}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                        <button
                                          onClick={(e) => handleDeleteVersion(e, project.id, scene.id, pv.version)}
                                          className="absolute right-1 top-1/2 -translate-y-1/2 hidden rounded-md p-0.5 text-muted-foreground hover:text-destructive group-hover/version:block"
                                          title="删除版本"
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      </div>
                                      {isVersionExpanded && pv.shots.length > 0 && (
                                        <SidebarMenuSub>
                                          {pv.shots.map((shot) => (
                                            <SidebarMenuSubItem key={shot.id} className="group/shot relative pr-8">
                                              <SidebarMenuSubButton asChild className="pr-8">
                                                <Link href={`/projects/${project.id}/scenes/${scene.id}/shots/${shot.id}`}>
                                                  <Image className="size-4 shrink-0" />
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <span className="truncate">{shot.displayName}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">{shot.displayName}</TooltipContent>
                                                  </Tooltip>
                                                </Link>
                                              </SidebarMenuSubButton>
                                              <button
                                                onClick={(e) => handleRename(e, "shot", shot.id, shot.alias, shot.shotName)}
                                                className="absolute right-6 top-1/2 -translate-y-1/2 hidden rounded-md p-0.5 text-muted-foreground hover:text-foreground group-hover/shot:block"
                                                                title="重命名"
                                              >
                                                <Pencil className="size-3" />
                                              </button>
                                              <button
                                                onClick={(e) => handleDeleteShot(e, shot.id, shot.displayName)}
                                                className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden rounded-md p-0.5 text-muted-foreground hover:text-destructive group-hover/shot:block"
                                                                title="删除分镜"
                                              >
                                                <Trash2 className="size-3" />
                                              </button>
                                            </SidebarMenuSubItem>
                                          ))}
                                        </SidebarMenuSub>
                                      )}
                                    </SidebarMenuSubItem>
                                  );
                                })}
                              </SidebarMenuSub>
                            )}
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleCreateProject}>
              <Plus className="size-4" />
              <span>新建项目</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
      </div>
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={startResizing}
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50",
          "hover:bg-primary/20 transition-colors",
          isResizing && "bg-primary/30"
        )}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="size-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
