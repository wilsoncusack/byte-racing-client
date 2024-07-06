import React from "react";

interface Position {
  x: number;
  y: number;
}

interface GameMapProps {
  map: number[][];
  path: Position[];
  outcome: "Finish" | "Crash" | "Revert" | "Halt";
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
        return "#22c55e"; // green
      case "Crash":
        return "#ef4444"; // red
      case "Revert":
        return "#eab308"; // yellow
      case "Halt":
        return "#3b82f6"; // blue
      default:
        return "#6b7280"; // gray
    }
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
                    cell === 0 ? "white" : cell === 1 ? "#6b7280" : "#ef4444"
                  }
                  stroke="#374151"
                  strokeWidth="1"
                />
                {cell === -1 && (
                  <text
                    x={x + cellSize / 2}
                    y={y + cellSize / 2}
                    fontSize={cellSize * 0.7}
                    textAnchor="middle"
                    dominantBaseline="central"
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
          d={`M ${path[0].x * cellSize + cellSize / 2} ${path[0].y * cellSize + cellSize / 2} 
           ${path
             .slice(1)
             .map(
               (p) =>
                 `L ${p.x * cellSize + cellSize / 2} ${p.y * cellSize + cellSize / 2}`,
             )
             .join(" ")}`}
          stroke={getOutcomeColor(outcome)}
          strokeWidth="3"
          fill="none"
        />

        {/* Draw car at the end of the path */}
        <text
          x={path[path.length - 1].x * cellSize + cellSize / 2}
          y={path[path.length - 1].y * cellSize + cellSize / 2}
          fontSize={cellSize * 0.7}
          textAnchor="middle"
          dominantBaseline="central"
        >
          🚗
        </text>
      </g>
    </svg>
  );
};

export default GameMap;
