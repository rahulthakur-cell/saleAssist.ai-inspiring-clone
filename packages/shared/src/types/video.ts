// ============================================================
// Video & Streaming Types
// ============================================================

export interface VideoCallSummary {
  id: string;
  roomName: string;
  type: string;
  status: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  agentName?: string | null;
}

export interface LiveStreamSummary {
  id: string;
  title: string;
  status: string;
  thumbnailUrl?: string | null;
  scheduledAt?: string | null;
  peakViewers: number;
  totalViewers: number;
  isShoppable: boolean;
}

export interface ShoppableVideoSummary {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  status: string;
  displayType: string;
  views: number;
  clicks: number;
  conversions: number;
  hotspotCount: number;
}

export interface VideoHotspotData {
  id: string;
  productName: string;
  productUrl: string;
  productImage?: string | null;
  price?: number | null;
  currency: string;
  startTime: number;
  endTime: number;
  posX?: number | null;
  posY?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface VideoFaqSummary {
  id: string;
  title: string;
  status: string;
  itemCount: number;
}
