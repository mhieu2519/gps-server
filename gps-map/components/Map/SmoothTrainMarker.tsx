// gps-server/gps-map/components/Map/SmoothTrainMarker.tsx
"use client";

import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";

interface Props {
  targetPosition: [number, number];
  heading: number;
  duration?: number;
  icon: L.Icon;
  children?: React.ReactNode;
}

// Hàm Easing Ease-Out Quad giúp giảm tốc mượt mà ở điểm cuối
const easeOutQuad = (p: number) => p * (2 - p);

// Hàm xử lý nội suy góc quay tránh bị xoay ngược vòng lớn (ví dụ từ 350 độ sang 10 độ)
const interpolateAngle = (start: number, end: number, progress: number) => {
  let delta = end - start;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return start + delta * progress;
};

export default function SmoothTrainMarker({ targetPosition, heading, duration = 1000, icon, children }: Props) {
  const markerRef = useRef<L.Marker | null>(null);

  // Lưu trữ trạng thái động thực tế để làm gốc cho lần cập nhật tiếp theo
  const currentPosRef = useRef<[number, number]>(targetPosition);
  const currentHeadingRef = useRef<number>(heading);

  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Chốt điểm xuất phát CHÍNH XÁC là vị trí thực tế hiện tại của tàu 
    const startLat = currentPosRef.current[0];
    const startLng = currentPosRef.current[1];
    const startHeading = currentHeadingRef.current;

    const targetLat = targetPosition[0];
    const targetLng = targetPosition[1];
    const targetHeading = heading;

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Áp dụng Easing thay vì Linear thường
      const easedProgress = easeOutQuad(progress);

      // Tính toán vị trí nội suy mới
      const currentLat = startLat + (targetLat - startLat) * easedProgress;
      const currentLng = startLng + (targetLng - startLng) * easedProgress;

      //  Nội suy góc xoay 
      const currentHeading = interpolateAngle(startHeading, targetHeading, easedProgress);

      // Lưu lại để nếu có dữ liệu mới gối đầu, ta có ngay điểm xuất phát chuẩn
      currentPosRef.current = [currentLat, currentLng];
      currentHeadingRef.current = currentHeading;

      // Can thiệp trực tiếp vào DOM Leaflet, KHÔNG RE-RENDER REACT
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
        if ((markerRef.current as any).setRotationAngle) {
          (markerRef.current as any).setRotationAngle(currentHeading);
        }
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [targetPosition, heading, duration]); // Đầy đủ và an toàn tuyệt đối khi refactor

  return (
    <Marker
      ref={markerRef}
      position={currentPosRef.current} // Vị trí khởi tạo ban đầu
      icon={icon}
    >
      {children}
    </Marker>
  );
}