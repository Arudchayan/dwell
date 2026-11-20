import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  ArcElement,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { useEffect, useRef } from 'preact/hooks';
import { formatDuration, HOUR, MINUTE } from '../core/time';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  DoughnutController,
  ArcElement,
);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function useChart(config: () => ChartConfiguration, deps: unknown[]) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, config());
    // Re-render on light/dark switch so colours follow the theme.
    const media = matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(() => rebuild());
    const rebuild = () => {
      const next = config();
      chart.data = next.data;
      chart.options = next.options ?? {};
      chart.update('none');
    };
    media.addEventListener('change', rebuild);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      media.removeEventListener('change', rebuild);
      observer.disconnect();
      chart.destroy();
    };
  }, deps);
  return canvas;
}

/** Pick a readable axis unit for a data range. */
function axisUnit(maxMs: number): { div: number; suffix: string } {
  return maxMs >= 2 * HOUR ? { div: HOUR, suffix: 'h' } : { div: MINUTE, suffix: 'm' };
}

export function BarChart({
  labels,
  values,
  highlight,
  height = 220,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  /** Index of a bar to emphasise (e.g. today). */
  highlight?: number;
  height?: number;
  ariaLabel: string;
}) {
  const canvas = useChart(() => {
    const accent = cssVar('--accent');
    const muted = cssVar('--accent-soft');
    const text = cssVar('--text-3');
    const grid = cssVar('--border');
    const unit = axisUnit(Math.max(0, ...values));
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((_, i) =>
              highlight === undefined || i === highlight ? accent : muted,
            ),
            borderRadius: 5,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => formatDuration(Number(ctx.raw)) } },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: text, maxRotation: 0, autoSkipPadding: 8 },
          },
          y: {
            beginAtZero: true,
            grid: { color: grid },
            border: { display: false },
            ticks: {
              color: text,
              maxTicksLimit: 5,
              callback: (v) => `${Math.round((Number(v) / unit.div) * 10) / 10}${unit.suffix}`,
            },
          },
        },
      },
    };
  }, [labels.join(), values.join(), highlight]);
  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel} />
    </div>
  );
}

export function DoughnutChart({
  labels,
  values,
  colors,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  ariaLabel: string;
}) {
  const canvas = useChart(
    () => ({
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: cssVar('--surface'),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.label}: ${formatDuration(Number(ctx.raw))}` },
          },
        },
      },
    }),
    [labels.join(), values.join(), colors.join()],
  );
  return (
    <div style={{ height: 200, position: 'relative' }}>
      <canvas ref={canvas} role="img" aria-label={ariaLabel} />
    </div>
  );
}
