import React from "react";
import { Outcome } from "../page";

interface Position {
  x: number;
  y: number;
}

interface GameMapProps {
  map: number[][];
  path: Position[];
  outcome: Outcome;
  cellSize?: number;
}

const GameMap: React.FC<GameMapProps> = ({
  map,
  path,
  outcome,
  cellSize = 30,
}) => {
  const width = map[0].length * cellSize;
  const height = map.length * cellSize;

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case "Finish":
        return "#00ff00"; // neon green
      case "Crash":
        return "#ff00ff"; // neon pink
      case "Revert":
        return "#ffff00"; // neon yellow
      case "Halt":
        return "#00ffff"; // neon cyan
      default:
        return "#ff8800"; // neon orange
    }
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id="neonGlow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={width} height={height} fill="#120d1e" />
      <g opacity="0.95">
        {map.map((row, rowIndex) =>
          row.map((cell, cellIndex) => {
            const x = cellIndex * cellSize;
            const y = rowIndex * cellSize;
            return (
              <g key={`${rowIndex}-${cellIndex}`}>
                <rect
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  fill={
                    cell === 0 ? "#1e1a2e" : cell === 1 ? "#3d3a4f" : "#ff00ff"
                  }
                  stroke="#6e7dff"
                  strokeWidth="0.5"
                  filter="url(#neonGlow)"
                />
                {cell === -1 && (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                    fontSize={cellSize * 0.7}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#00ffff"
                    filter="url(#neonGlow)"
                  >
                    🏁
                  </text>
                )}
              </g>
            );
          }),
        )}
        {/* Draw path */}
        <path
          d={`M ${path[0].x * cellSize + cellSize / 2} ${
            path[0].y * cellSize + cellSize / 2
          }
          ${path
            .slice(1)
            .map(
              (p) =>
                `L ${p.x * cellSize + cellSize / 2} ${
                  p.y * cellSize + cellSize / 2
                }`,
            )
            .join(" ")}`}
          stroke={getOutcomeColor(outcome)}
          strokeWidth="3"
          fill="none"
          filter="url(#neonGlow)"
        />
        {/* Draw car at the end of the path */}
        <text
          x={path[path.length - 1].x * cellSize + cellSize / 2}
          y={path[path.length - 1].y * cellSize + cellSize / 2}
          fontSize={cellSize * 0.7}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          filter="url(#neonGlow)"
        >
          {outcome === "Finish"
            ? "🏎️"
            : outcome === "Crash"
              ? "💥"
              : outcome === "Revert"
                ? "⚠️"
                : outcome === "Halt"
                  ? "🛑"
                  : outcome === "MaxGas"
                    ? "⛽"
                    : ""}
        </text>
      </g>
    </svg>
  );
};

export default GameMap;
