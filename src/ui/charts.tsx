import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import { useEffect, useRef } from 'preact/hooks';
import { formatDuration, HOUR, MINUTE } from '../core/time';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Pick a readable axis unit for a data range. */
function axisUnit(maxMs: number): { div: number; suffix: string } {
  return maxMs >= 2 * HOUR ? { div: HOUR, suffix: 'h' } : { div: MINUTE, suffix: 'm' };
}

function useChart(config: () => ChartConfiguration, deps: unknown[]) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, config());
    // Follow light/dark switches.
    const rebuild = () => {
      const next = config();
      chart.data = next.data;
      chart.options = next.options ?? {};
      chart.update('none');
    };
    const media = matchMedia('(prefers-color-scheme: dark)');
    const observer = new MutationObserver(rebuild);
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

/**
 * Quiet bar chart: thin teal bars, faint for context and solid for the bar
 * that matters (e.g. today), hairline grid, serif-free small labels.
 */
export function BarChart({
  labels,
  values,
  highlight,
  height = 200,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  highlight?: number;
  height?: number;
  ariaLabel: string;
}) {
  const canvas = useChart(() => {
    const accent = cssVar('--accent');
    const faint = cssVar('--accent-faint');
    const text = cssVar('--ink-3');
    const rule = cssVar('--rule');
    const unit = axisUnit(Math.max(0, ...values));
    const font = { family: cssVar('--sans'), size: 11 };
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((_, i) =>
              highlight === undefined || i === highlight ? accent : faint,
            ),
            borderRadius: 2,
            maxBarThickness: 18,
            categoryPercentage: 0.7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: cssVar('--ink'),
            titleColor: cssVar('--paper'),
            bodyColor: cssVar('--paper'),
            titleFont: font,
            bodyFont: { ...font, size: 12 },
            padding: 8,
            cornerRadius: 4,
            callbacks: { label: (ctx) => formatDuration(Number(ctx.raw)) },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: rule },
            ticks: { color: text, font, maxRotation: 0, autoSkipPadding: 10 },
          },
          y: {
            beginAtZero: true,
            grid: { color: rule, drawTicks: false },
            border: { display: false },
            ticks: {
              color: text,
              font,
              padding: 8,
              maxTicksLimit: 4,
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
