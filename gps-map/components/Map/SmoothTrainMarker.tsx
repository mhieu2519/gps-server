"use client";

import { useEffect, useState, useRef } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

interface SmoothTrainMarkerProps {
  targetPosition: [number, number];
  heading: number;
  duration?: number;
  icon: L.Icon;
  children: React.ReactNode;
}

export default function SmoothTrainMarker({ targetPosition, heading, duration = 2000, icon, children }: SmoothTrainMarkerProps) {
  const [currentPosition, setCurrentPosition] = useState<[number, number]>(targetPosition);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startPosRef = useRef<[number, number]>(targetPosition);

  useEffect(() => {
    // mỗi khi nhận tọa độ mới từ Socket tiến hành thực hiện nội suy tuyến tính (Lerp)
    startPosRef.current = currentPosition;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      if (!startTimeRef.current) return;

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1); // chạy từ 0 đến 1

      // tính tọa độ vị trí hiện thời giữa điểm cũ và điểm mới
      const currentLat = startPosRef.current[0] + (targetPosition[0] - startPosRef.current[0]) * progress;
      const currentLng = startPosRef.current[1] + (targetPosition[1] - startPosRef.current[1]) * progress;

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
      position={currentPosition}
      icon={icon}
      rotationAngle={heading}
      rotationOrigin="center"
    >
      {children}
    </Marker>
  );
}