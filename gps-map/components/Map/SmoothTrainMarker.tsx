"use client";

import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

interface Props {
  targetPosition: [number, number];
  heading: number;
  duration?: number;
  icon: L.Icon;
  children: React.ReactNode;
}

export default function SmoothTrainMarker({
  targetPosition,
  heading,
  duration = 200,
  icon,
  children
}: Props) {

  const markerRef = useRef<L.Marker | null>(null);
  const animationRef = useRef<number | null>(null);

  const currentPosRef = useRef<[number, number]>(targetPosition);

  useEffect(() => {

    const start = performance.now();
    const startPos = currentPosRef.current;

    const animate = (now: number) => {

      const progress = Math.min((now - start) / duration, 1);

      const lat =
        startPos[0] +
        (targetPosition[0] - startPos[0]) * progress;

      const lng =
        startPos[1] +
        (targetPosition[1] - startPos[1]) * progress;

      const pos: [number, number] = [lat, lng];

      currentPosRef.current = pos;

      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };

  }, [targetPosition, duration]);

  return (
    <Marker
      ref={markerRef}
      position={targetPosition}
      icon={icon}
      rotationAngle={heading}
      rotationOrigin="center"
    >
      {children}
    </Marker>
  );
}