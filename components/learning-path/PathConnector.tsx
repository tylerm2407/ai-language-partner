import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';
import { useUi2Theme } from '../../hooks/useUi2Theme';

interface PathConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  state: 'completed' | 'locked';
}

/**
 * A drawn connector is the completed hue; an undrawn one is the same hairline
 * the card borders use, so it recedes in whichever scheme is on. (`#252A35`,
 * the value it replaces, was a dark-only slate that vanishes on white.)
 */
export function PathConnector({ fromX, fromY, toX, toY, state }: PathConnectorProps) {
  const { c } = useUi2Theme();
  const isCompleted = state === 'completed';
  const strokeColor = isCompleted ? c.green : c.cardBorder;
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
