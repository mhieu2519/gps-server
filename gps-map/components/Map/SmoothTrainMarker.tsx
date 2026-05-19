// SmoothTrainMarker.tsx (Bản chuẩn không xung đột)
"use client";

import { useEffect, useState, useRef } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

interface Props {
  targetPosition: [number, number];
  heading: number;
  duration?: number;
  icon: L.Icon;
  children: React.ReactNode;
}

export default function SmoothTrainMarker({ targetPosition, heading, duration = 2000, icon, children }: Props) {
  // Dùng state kiểm soát vị trí hiển thị của React để đồng bộ re-render
  const [currentPosition, setCurrentPosition] = useState<[number, number]>(targetPosition);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const previousTargetPosRef = useRef<[number, number]>(targetPosition);

  useEffect(() => {
    const startLat = previousTargetPosRef.current[0];
    const startLng = previousTargetPosRef.current[1];

    previousTargetPosRef.current = targetPosition;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      if (!startTimeRef.current) return;

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const currentLat = startLat + (targetPosition[0] - startLat) * progress;
      const currentLng = startLng + (targetPosition[1] - startLng) * progress;

      setCurrentPosition([currentLat, currentLng]);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [targetPosition, duration]);

  return (
    <Marker
      position={currentPosition} // Luôn đi theo vị trí đang nội suy mượt mà
      icon={icon}
      {...({
        rotationAngle: heading,
        rotationOrigin: "center"
      } as any)}
    >
      {children}
    </Marker>
  );
}