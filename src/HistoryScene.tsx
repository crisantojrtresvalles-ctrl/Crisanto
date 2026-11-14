import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const progress = frame / 1800;

    camera.position.set(
      -1.5 + progress * 3,
      2.5 + Math.sin(progress * Math.PI * 2) * 0.3,
      14,
    );

    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, frame]);

  return null;
};

const Character: React.FC<{
  position: [number, number, number];
  color: string;
  delay: number;
}> = ({ position, color, delay }) => {
  const frame = useCurrentFrame();

  const movement = Math.sin((frame + delay) * 0.12) * 0.12;
  const rotation = Math.sin((frame + delay) * 0.08) * 0.08;

  return (
    <group
      position={[position[0], position[1] + movement, position[2]]}
      rotation={[0, rotation, 0]}
    >
      {/* Head */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#d5a47c" />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.17, 0.25, 0.85, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.29, 0.52, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.65, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0.29, 0.52, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.65, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.11, -0.12, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.55, 8]} />
        <meshStandardMaterial color="#292323" />
      </mesh>

      <mesh position={[0.11, -0.12, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.55, 8]} />
        <meshStandardMaterial color="#292323" />
      </mesh>
    </group>
  );
};

const Environment: React.FC = () => {
  return (
    <>
      <color attach="background" args={["#9babb4"]} />
      <fog attach="fog" args={["#9babb4", 18, 45]} />

      <ambientLight intensity={0.55} />

      <directionalLight
        position={[-5, 9, 7]}
        intensity={2.2}
        color="#ffe0b0"
      />

      <directionalLight
        position={[5, 4, -5]}
        intensity={0.65}
        color="#9db8d2"
      />

      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.4, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#625746" roughness={1} />
      </mesh>

      {/* Distant landscape */}
      <mesh position={[-7, -0.7, -9]} scale={[7, 3, 1]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#596b68" />
      </mesh>

      <mesh position={[7, -0.9, -11]} scale={[8, 3.5, 1]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#465b59" />
      </mesh>

      {/* Historical fortress */}
      <group position={[0, -1.35, -5]}>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[7, 3, 1]} />
          <meshStandardMaterial color="#77695b" roughness={1} />
        </mesh>

        <mesh position={[-2.5, 3.5, 0]}>
          <boxGeometry args={[1.5, 2, 1.5]} />
          <meshStandardMaterial color="#625448" />
        </mesh>

        <mesh position={[2.5, 3.5, 0]}>
          <boxGeometry args={[1.5, 2, 1.5]} />
          <meshStandardMaterial color="#625448" />
        </mesh>

        <mesh position={[0, 0.7, 0.53]}>
          <boxGeometry args={[1.1, 1.5, 0.1]} />
          <meshStandardMaterial color="#302c28" />
        </mesh>
      </group>

      {/* Atmospheric sun */}
      <mesh position={[5, 6, -16]}>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial color="#f6d5a0" />
      </mesh>
    </>
  );
};

const HistoricalAction: React.FC = () => {
  const frame = useCurrentFrame();

  const movement = interpolate(
    frame,
    [0, 900, 1800],
    [-2.5, 0, 2.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <>
      <Character
        position={[movement, -0.7, 2]}
        color="#754b32"
        delay={0}
      />

      <Character
        position={[movement + 2.2, -0.7, 1]}
        color="#343b43"
        delay={30}
      />
    </>
  );
};

export const HistoryScene: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#9babb4" }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
      >
        <CameraRig />
        <Environment />
        <HistoricalAction />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
