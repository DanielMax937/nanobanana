"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pen, Type, Eraser, Undo2, Trash2 } from "lucide-react";

type Tool = "pen" | "text" | "eraser";

interface ImageAnnotatorProps {
  imageSrc: string;
  open: boolean;
  onConfirm: (annotatedBase64: string) => void;
  onCancel: () => void;
}

export function ImageAnnotator({ imageSrc, open, onConfirm, onCancel }: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [drawing, setDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load image and initialize canvas
  useEffect(() => {
    if (!open) {
      setHistory([]);
      setImageLoaded(false);
      setTool("pen");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Fit canvas to container width while maintaining aspect ratio
      const container = containerRef.current;
      const maxWidth = container ? container.clientWidth : 800;
      const scale = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setImageLoaded(true);
      // Save initial state
      setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    };
    img.src = imageSrc;
  }, [open, imageSrc]);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const setupCtx = (ctx: CanvasRenderingContext2D) => {
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 4;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      handleTextPlace(e);
      return;
    }
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    setupCtx(ctx);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    // If eraser was used, redraw the base image under remaining annotations
    if (tool === "eraser") {
      restoreWithImage();
    }
    saveSnapshot();
  };

  // For eraser: we need to redraw the base image underneath
  const restoreWithImage = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    // Save current annotations
    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Redraw base image
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Draw annotations on top (composite)
    ctx.putImageData(currentData, 0, 0);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (tool === "text") return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    setupCtx(ctx);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing) return;
    setDrawing(false);
    if (tool === "eraser") restoreWithImage();
    saveSnapshot();
  };

  const handleTextPlace = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const text = prompt("输入标注文字：");
    if (!text) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.globalCompositeOperation = "source-over";
    ctx.font = "bold 24px sans-serif";
    ctx.fillStyle = "#ff0000";
    ctx.fillText(text, pos.x, pos.y);
    saveSnapshot();
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const newHistory = history.slice(0, -1);
    const prev = newHistory[newHistory.length - 1];
    ctx.putImageData(prev, 0, 0);
    setHistory(newHistory);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([snapshot]);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL("image/png").split(",")[1]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>标注修改</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1 mb-2">
          <Button
            size="sm"
            variant={tool === "pen" ? "default" : "outline"}
            onClick={() => setTool("pen")}
          >
            <Pen className="mr-1 h-4 w-4" />
            画笔
          </Button>
          <Button
            size="sm"
            variant={tool === "text" ? "default" : "outline"}
            onClick={() => setTool("text")}
          >
            <Type className="mr-1 h-4 w-4" />
            文字
          </Button>
          <Button
            size="sm"
            variant={tool === "eraser" ? "default" : "outline"}
            onClick={() => setTool("eraser")}
          >
            <Eraser className="mr-1 h-4 w-4" />
            橡皮
          </Button>
          <Button size="sm" variant="outline" onClick={handleUndo} disabled={history.length <= 1}>
            <Undo2 className="mr-1 h-4 w-4" />
            撤销
          </Button>
          <Button size="sm" variant="outline" onClick={handleClear}>
            <Trash2 className="mr-1 h-4 w-4" />
            清除
          </Button>
        </div>

        <div ref={containerRef} className="w-full">
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg border cursor-crosshair touch-none"
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!imageLoaded}>
            确认标注
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
