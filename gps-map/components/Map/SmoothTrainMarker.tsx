//
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
  const previousTargetPosRef = useRef<[number, number]>(targetPosition);

  useEffect(() => {
    // Điểm bắt đầu nội suy (start) chính là điểm đích (target) của chu kỳ trước
    const startLat = previousTargetPosRef.current[0];
    const startLng = previousTargetPosRef.current[1];

    // Cập nhật lại vị trí đích hiện tại vào ref để dùng cho chu kỳ kế tiếp
    previousTargetPosRef.current = targetPosition;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      if (!startTimeRef.current) return;

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1); // chạy từ 0 đến 1

      // tính tọa độ vị trí hiện thời giữa điểm cũ và điểm mới
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
      position={currentPosition}
      icon={icon}
      rotationAngle={heading}
      rotationOrigin="center"
    >
      {children}
    </Marker>
  );
}