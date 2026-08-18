import { Chart, type ChartConfiguration } from 'chart.js';
import { useEffect, useRef } from 'react';
import { setupCharts } from './chartSetup';

interface Props {
  /** Muss memoisiert sein — bei neuer Identität wird das Diagramm neu gebaut. */
  config: ChartConfiguration;
  /** Kurzbeschreibung des Inhalts; ein Canvas ist sonst für Vorlesesoftware stumm. */
  label: string;
  height?: number;
}

/**
 * Duenne Huelle um Chart.js. Bewusst neu aufgebaut statt in-place aktualisiert:
 * Die Datenmengen hier sind winzig, und das erspart die ganze Klasse an
 * Update-Fehlern, in denen alte Datensaetze haengen bleiben.
 */
export function ChartCanvas({ config, label, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setupCharts();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [config]);

  return (
    <div className="chartBox" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
