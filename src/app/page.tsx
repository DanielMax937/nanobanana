import { Film } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Film className="mx-auto size-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          欢迎使用 Nano
        </h1>
        <p className="mt-2 text-muted-foreground">
          从左侧栏新建项目，然后添加场景开始创作
        </p>
      </div>
    </div>
  );
}
