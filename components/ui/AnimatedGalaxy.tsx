import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface StarData {
  x: number;
  y: number;
  r: number;
  color: string;
  opacity: number;
  group: number;
}

interface HeroStarData {
  x: number;
  y: number;
  r: number;
  color: string;
  glowColor: string;
}

interface NebulaData {
  cx: number;
  cy: number;
  r: number;
  color: string;
  opacity: number;
}

// ─── Star color palettes ──────────────────────────────────────────────────────
const COLORS_COOL = [
  'rgba(255,255,255,1)',
  'rgba(230,240,255,1)',
  'rgba(200,215,255,1)',
  'rgba(210,225,250,1)',
  'rgba(190,210,255,1)',
];

const COLORS_WARM = [
  'rgba(255,255,255,1)',
  'rgba(255,240,220,1)',
  'rgba(255,225,200,1)',
];

const COLORS_ACCENT = [
  'rgba(180,160,255,1)',
  'rgba(140,200,255,1)',
  'rgba(200,170,255,1)',
  'rgba(100,210,240,1)',
];

function pickColor(rand: () => number): string {
  const roll = rand();
  if (roll < 0.55) return COLORS_COOL[Math.floor(rand() * COLORS_COOL.length)];
  if (roll < 0.75) return COLORS_WARM[Math.floor(rand() * COLORS_WARM.length)];
  return COLORS_ACCENT[Math.floor(rand() * COLORS_ACCENT.length)];
}

// ─── Generation helpers ───────────────────────────────────────────────────────
function generateLayer(
  count: number,
  sizeMin: number,
  sizeMax: number,
  opacityMin: number,
  opacityMax: number,
  seed: number,
): StarData[] {
  const rand = seededRandom(seed);
  const pad = 40;
  const stars: StarData[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: -pad + rand() * (W + 2 * pad),
      y: -pad + rand() * (H + 2 * pad),
      r: sizeMin + rand() * (sizeMax - sizeMin),
      color: pickColor(rand),
      opacity: opacityMin + rand() * (opacityMax - opacityMin),
      group: rand() < 0.5 ? 0 : 1,
    });
  }
  return stars;
}

function generateHeroes(count: number, seed: number): HeroStarData[] {
  const rand = seededRandom(seed);
  const heroes: HeroStarData[] = [];
  for (let i = 0; i < count; i++) {
    const isBlue = rand() < 0.35;
    heroes.push({
      x: 40 + rand() * (W - 80),
      y: 40 + rand() * (H - 80),
      r: 4 + rand() * 3,
      color: 'rgba(255,255,255,1)',
      glowColor: isBlue ? 'rgba(140,180,255,0.12)' : 'rgba(200,180,255,0.12)',
    });
  }
  return heroes;
}

function generateNebulae(seed: number): NebulaData[] {
  const rand = seededRandom(seed);
  return [
    { cx: W * (0.18 + rand() * 0.15), cy: H * (0.18 + rand() * 0.12), r: 110 + rand() * 70, color: '#3b0764', opacity: 0.05 + rand() * 0.02 },
    { cx: W * (0.72 + rand() * 0.18), cy: H * (0.32 + rand() * 0.18), r: 90 + rand() * 55, color: '#1e1b4b', opacity: 0.04 + rand() * 0.03 },
    { cx: W * (0.35 + rand() * 0.25), cy: H * (0.68 + rand() * 0.12), r: 130 + rand() * 70, color: '#4a044e', opacity: 0.03 + rand() * 0.02 },
    { cx: W * (0.08 + rand() * 0.12), cy: H * (0.82 + rand() * 0.1), r: 80 + rand() * 50, color: '#581c87', opacity: 0.03 + rand() * 0.02 },
    { cx: W * (0.85 + rand() * 0.1), cy: H * (0.75 + rand() * 0.1), r: 70 + rand() * 45, color: '#312e81', opacity: 0.03 + rand() * 0.02 },
  ];
}

// ─── Preset configs ───────────────────────────────────────────────────────────
interface GalaxyPreset {
  far: number;
  mid: number;
  near: number;
  hero: number;
}

const DENSITY_PRESETS: Record<string, GalaxyPreset> = {
  low:    { far: 60,  mid: 30,  near: 12, hero: 4  },
  medium: { far: 100, mid: 50,  near: 20, hero: 6  },
  high:   { far: 150, mid: 70,  near: 30, hero: 10 },
};

const SPEED_MULT: Record<string, number> = { slow: 0.5, medium: 1, fast: 1.6 };
const GLOW_MULT: Record<string, number>  = { subtle: 0.5, medium: 1, strong: 1.5 };

// ─── Oscillation helper ──────────────────────────────────────────────────────
// Creates a looping Animated.Value that oscillates between -amplitude and +amplitude
// with sinusoidal easing and runs on the native driver.
function useOscillation(amplitude: number, durationMs: number): Animated.Value {
  const val = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, {
          toValue: 1,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: -1,
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: 0,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [val, durationMs]);
  return val;
}

// Creates a looping opacity oscillation between min and max
function useTwinkle(min: number, max: number, durationMs: number): Animated.Value {
  const val = useRef(new Animated.Value(min)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(val, {
          toValue: max,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(val, {
          toValue: min,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [val, min, max, durationMs]);
  return val;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface AnimatedGalaxyProps {
  density?: 'low' | 'medium' | 'high';
  speed?: 'slow' | 'medium' | 'fast';
  glowIntensity?: 'subtle' | 'medium' | 'strong';
  twinkleEnabled?: boolean;
  reducedMotion?: boolean;
}

// ─── Static star View ─────────────────────────────────────────────────────────
const StarView = React.memo(({ x, y, r, color, opacity }: StarData) => (
  <View
    style={{
      position: 'absolute',
      left: x - r,
      top: y - r,
      width: r * 2,
      height: r * 2,
      borderRadius: r,
      backgroundColor: color,
      opacity,
    }}
  />
));

// ─── Hero star with glow ──────────────────────────────────────────────────────
const HeroStarView = React.memo(({ star, glowMul }: { star: HeroStarData; glowMul: number }) => {
  const glowR = star.r * 6 * glowMul;
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: star.x - glowR,
          top: star.y - glowR,
          width: glowR * 2,
          height: glowR * 2,
          borderRadius: glowR,
          backgroundColor: star.glowColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: star.x - star.r,
          top: star.y - star.r,
          width: star.r * 2,
          height: star.r * 2,
          borderRadius: star.r,
          backgroundColor: star.color,
          opacity: 0.9,
        }}
      />
    </>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────
export function AnimatedGalaxy({
  density = 'medium',
  speed = 'medium',
  glowIntensity = 'medium',
  twinkleEnabled = true,
  reducedMotion = false,
}: AnimatedGalaxyProps) {
  const preset = DENSITY_PRESETS[density];
  const spdMul = reducedMotion ? 0.15 : SPEED_MULT[speed];
  const glwMul = GLOW_MULT[glowIntensity];

  // ── Pre-compute all star data ──
  const data = useMemo(() => ({
    far:     generateLayer(preset.far,  1, 2,    0.15, 0.50, 42),
    mid:     generateLayer(preset.mid,  2, 3.5,  0.30, 0.70, 137),
    near:    generateLayer(preset.near, 3, 5,    0.50, 0.95, 256),
    heroes:  generateHeroes(preset.hero, 999),
    nebulae: generateNebulae(777),
  }), [density]);

  // ── Split into twinkle sub-groups ──
  const { farA, farB, midA, midB, nearA, nearB } = useMemo(() => ({
    farA:  data.far.filter(s => s.group === 0),
    farB:  data.far.filter(s => s.group === 1),
    midA:  data.mid.filter(s => s.group === 0),
    midB:  data.mid.filter(s => s.group === 1),
    nearA: data.near.filter(s => s.group === 0),
    nearB: data.near.filter(s => s.group === 1),
  }), [data]);

  // ── Drift animations (parallax) ──
  // Different durations per layer create natural phase offsets
  const baseDuration = 25000 / spdMul;

  const farDriftX  = useOscillation(8,  baseDuration * 1.2);
  const farDriftY  = useOscillation(6,  baseDuration * 1.4);
  const midDriftX  = useOscillation(14, baseDuration * 0.85);
  const midDriftY  = useOscillation(10, baseDuration * 1.0);
  const nearDriftX = useOscillation(20, baseDuration * 0.65);
  const nearDriftY = useOscillation(14, baseDuration * 0.8);
  const heroDriftX = useOscillation(23, baseDuration * 0.55);
  const heroDriftY = useOscillation(16, baseDuration * 0.7);

  // ── Twinkle animations (6 sub-groups, different durations for phase offset) ──
  const farTwinkleA  = useTwinkle(twinkleEnabled ? 0.30 : 1, 1, 4500 / spdMul);
  const farTwinkleB  = useTwinkle(twinkleEnabled ? 0.30 : 1, 1, 5500 / spdMul);
  const midTwinkleA  = useTwinkle(twinkleEnabled ? 0.10 : 1, 1, 3800 / spdMul);
  const midTwinkleB  = useTwinkle(twinkleEnabled ? 0.10 : 1, 1, 4200 / spdMul);
  const nearTwinkleA = useTwinkle(twinkleEnabled ? 0.00 : 1, 1, 3000 / spdMul);
  const nearTwinkleB = useTwinkle(twinkleEnabled ? 0.00 : 1, 1, 3500 / spdMul);

  // ── Nebula pulse ──
  const nebulaPulse = useOscillation(0.15, 40000 / spdMul);

  // ── Build animated styles ──
  const farStyle = {
    transform: [
      { translateX: farDriftX as unknown as number },
      { translateY: farDriftY as unknown as number },
    ],
  };
  const midStyle = {
    transform: [
      { translateX: midDriftX as unknown as number },
      { translateY: midDriftY as unknown as number },
    ],
  };
  const nearStyle = {
    transform: [
      { translateX: nearDriftX as unknown as number },
      { translateY: nearDriftY as unknown as number },
    ],
  };
  const heroStyle = {
    transform: [
      { translateX: heroDriftX as unknown as number },
      { translateY: heroDriftY as unknown as number },
    ],
  };
  const nebulaStyle = {
    transform: [
      { scale: Animated.add(1, nebulaPulse) as unknown as number },
    ],
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ── Nebula blobs ── */}
      <Animated.View style={[StyleSheet.absoluteFill, nebulaStyle]}>
        {data.nebulae.map((n, i) => (
          <View
            key={`neb-${i}`}
            style={{
              position: 'absolute',
              left: n.cx - n.r,
              top: n.cy - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: n.r,
              backgroundColor: n.color,
              opacity: n.opacity,
            }}
          />
        ))}
      </Animated.View>

      {/* ── Far star layer ── */}
      <Animated.View style={[StyleSheet.absoluteFill, farStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: farTwinkleA }]}>
          {farA.map((s, i) => <StarView key={`fa-${i}`} {...s} />)}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: farTwinkleB }]}>
          {farB.map((s, i) => <StarView key={`fb-${i}`} {...s} />)}
        </Animated.View>
      </Animated.View>

      {/* ── Mid star layer ── */}
      <Animated.View style={[StyleSheet.absoluteFill, midStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: midTwinkleA }]}>
          {midA.map((s, i) => <StarView key={`ma-${i}`} {...s} />)}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: midTwinkleB }]}>
          {midB.map((s, i) => <StarView key={`mb-${i}`} {...s} />)}
        </Animated.View>
      </Animated.View>

      {/* ── Near star layer ── */}
      <Animated.View style={[StyleSheet.absoluteFill, nearStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: nearTwinkleA }]}>
          {nearA.map((s, i) => <StarView key={`na-${i}`} {...s} />)}
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: nearTwinkleB }]}>
          {nearB.map((s, i) => <StarView key={`nb-${i}`} {...s} />)}
        </Animated.View>
      </Animated.View>

      {/* ── Hero stars ── */}
      <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
        {data.heroes.map((h, i) => (
          <HeroStarView key={`hero-${i}`} star={h} glowMul={glwMul} />
        ))}
      </Animated.View>
    </View>
  );
}
