import React, { useEffect, useRef } from 'react';

type DottedGlowBackgroundProps = {
  className?: string;
  gap?: number;      // 点之间的间距
  radius?: number;   // 点的半径
  color?: string;    // 普通点的颜色
  glowColor?: string;// 呼吸发光时的颜色
  speedScale?: number;// 动画速度
};

export default function DottedGlowBackground({
  className,
  gap = 24,
  radius = 1.5,
  color = "rgba(255,255,255,0.02)",
  glowColor = "rgba(255, 255, 255, 0.15)",
  speedScale = 0.5,
}: DottedGlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    const container = containerRef.current;
    if (!el || !container) return;

    const ctx = el.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    // 调整画布大小
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      el.width = width * dpr;
      el.height = height * dpr;
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // 生成点阵
    let dots: any[] = [];
    const initDots = () => {
      dots = [];
      const { width, height } = container.getBoundingClientRect();
      // 多生成一圈避免边缘空白
      for (let x = -gap; x < width + gap; x += gap) {
        for (let y = -gap; y < height + gap; y += gap) {
          // 稍微错位一点，显得不那么死板
          const actualX = x + (Math.floor(y / gap) % 2 === 0 ? 0 : gap * 0.5);
          dots.push({
            x: actualX,
            y,
            // 随机相位，让每个点的呼吸节奏不一样
            phase: Math.random() * Math.PI * 2, 
            speed: 0.5 + Math.random() * 0.5 // 随机速度
          });
        }
      }
    };

    initDots();
    window.addEventListener("resize", initDots);

    // 动画循环
    const draw = (now: number) => {
      const { width, height } = container.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      
      const time = (now / 1000) * speedScale;

      dots.forEach((d) => {
        // 计算呼吸效果 (0 到 1 之间波动)
        const intensity = (Math.sin(time * d.speed + d.phase) + 1) / 2;
        
        ctx.beginPath();
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
        
        // 只有亮度高的点才发光，制造"星光"效果
        if (intensity > 0.8) {
           ctx.fillStyle = glowColor;
           // Canvas 发光效果
           ctx.shadowColor = glowColor;
           ctx.shadowBlur = 15;
        } else {
           ctx.fillStyle = color;
           ctx.shadowBlur = 0;
        }
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", initDots);
      ro.disconnect();
    };
  }, [gap, radius, color, glowColor, speedScale]);

  return (
    <div ref={containerRef} className={className} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

