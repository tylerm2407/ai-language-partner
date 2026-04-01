import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

interface PathConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  state: 'completed' | 'locked';
}

export function PathConnector({ fromX, fromY, toX, toY, state }: PathConnectorProps) {
  const isCompleted = state === 'completed';
  const strokeColor = isCompleted ? '#34D399' : '#252A35';
  const strokeWidth = isCompleted ? 3 : 2;
  const strokeDasharray = isCompleted ? undefined : '6,6';

  // Calculate SVG viewport bounds with some padding
  const minX = Math.min(fromX, toX) - 20;
  const minY = Math.min(fromY, toY);
  const width = Math.abs(toX - fromX) + 40;
  const height = Math.abs(toY - fromY);

  if (height === 0) return null;

  // Translate coordinates to local SVG space
  const localFromX = fromX - minX;
  const localFromY = fromY - minY;
  const localToX = toX - minX;
  const localToY = toY - minY;

  // Cubic bezier control points: midpoint Y with X matching start/end
  const midY = (localFromY + localToY) / 2;
  const d = `M ${localFromX} ${localFromY} C ${localFromX} ${midY}, ${localToX} ${midY}, ${localToX} ${localToY}`;

  return (
    <View
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width,
        height,
      }}
      pointerEvents="none"
    >
      <Svg width={width} height={height}>
        <Path
          d={d}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          fill="none"
        />
      </Svg>
    </View>
  );
}
