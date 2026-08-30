import React from 'react';

interface AntiScreenshotGuardProps {
  children: React.ReactNode;
  isActive?: boolean;
  userAlias?: string;
  roomId?: string;
}

export function AntiScreenshotGuard({
  children,
}: AntiScreenshotGuardProps) {
  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {children}
    </div>
  );
}
