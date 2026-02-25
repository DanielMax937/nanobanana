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

type Scene = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
};

type Project = {
  id: string;
  name: string;
  scenes: Scene[];
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set()
  );

  const fetchProjects = React.useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
  }, []);

  React.useEffect(() => {
    fetchProjects();
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

  const handleCreateProject = async () => {
    const name = prompt("项目名称");
    if (!name?.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    await fetchProjects();
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation();
    if (!confirm("确定删除该项目及其所有场景？")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    await fetchProjects();
    if (pathname.startsWith(`/projects/${projectId}`)) {
      router.push("/");
    }
  };

  const handleCreateScene = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation();
    const name = prompt("场景名称");
    if (!name?.trim()) return;
    const res = await fetch(`/api/projects/${projectId}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const scene = await res.json();
    await fetchProjects();
    setExpandedProjects((prev) => new Set(prev).add(projectId));
    router.push(`/projects/${projectId}/scenes/${scene.id}`);
  };

  const handleDeleteScene = async (
    e: React.MouseEvent,
    projectId: string,
    sceneId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确定删除该场景？")) return;
    await fetch(`/api/projects/${projectId}/scenes/${sceneId}`, {
      method: "DELETE",
    });
    await fetchProjects();
    if (pathname.includes(sceneId)) {
      router.push("/");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-lg font-bold tracking-tight">Nano</span>
          <Button variant="ghost" size="icon" className="size-7">
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
                  <SidebarMenuButton
                    onClick={() => toggleProject(project.id)}
                    tooltip={project.name}
                  >
                    <ChevronRight
                      className={`size-4 shrink-0 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                    <FolderOpen className="size-4 shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={(e) => handleCreateScene(e, project.id)}
                    title="添加场景"
                  >
                    <Plus className="size-4" />
                  </SidebarMenuAction>
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
                        return (
                          <SidebarMenuSubItem key={scene.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive}
                            >
                              <Link href={scenePath}>
                                <Film className="size-4 shrink-0" />
                                <span className="truncate">{scene.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                            <button
                              onClick={(e) =>
                                handleDeleteScene(e, project.id, scene.id)
                              }
                              className="absolute right-1 top-1.5 hidden rounded-md p-0.5 text-muted-foreground hover:text-destructive group-hover/menu-sub-item:block"
                              title="删除场景"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
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
          {projects.length > 0 && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={async () => {
                  const project = projects.find((p) =>
                    pathname.startsWith(`/projects/${p.id}`)
                  );
                  if (project) {
                    await handleDeleteProject(
                      { stopPropagation: () => {} } as React.MouseEvent,
                      project.id
                    );
                  }
                }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span>删除当前项目</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
