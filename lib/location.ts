import { HOSTEL_BLOCKS } from '@/lib/constants';

export type HostelBlock = typeof HOSTEL_BLOCKS[number];

/**
 * Campus landmark or handover spot representation for future route/path-based handover planning.
 */
export interface HandoverSpot {
  name: string;
  description: string;
  landmarkType: 'hostel_common_area' | 'campus_midpoint' | 'campus_gate';
  approxDistanceMeters: number;
}

/**
 * Relative campus zone mapping for NIT Warangal hostels.
 * Designed to cleanly transition to coordinate-based & path-distance routing.
 */
interface HostelLocationMeta {
  zone: 'mega_zone' | 'pg_zone' | 'senior_zone' | 'off_campus';
  /** Approximate relative local campus grid coordinates (x, y in meters relative to campus center) */
  coord: [number, number];
  defaultMeetingSpot: string;
}

const HOSTEL_LOCATIONS: Record<string, HostelLocationMeta> = {
  '1-Block': { zone: 'mega_zone', coord: [100, 200], defaultMeetingSpot: '1-Block Entrance / Lounge' },
  '2-Block': { zone: 'mega_zone', coord: [130, 210], defaultMeetingSpot: '2-Block Entrance / Lounge' },
  '3-Block': { zone: 'mega_zone', coord: [160, 220], defaultMeetingSpot: '3-Block Entrance / Lounge' },
  '4-Block': { zone: 'mega_zone', coord: [190, 230], defaultMeetingSpot: '4-Block Entrance / Lounge' },
  '5-Block': { zone: 'mega_zone', coord: [220, 240], defaultMeetingSpot: '5-Block Entrance / Lounge' },
  '6-Block': { zone: 'mega_zone', coord: [250, 250], defaultMeetingSpot: '6-Block Entrance / Lounge' },
  '7-Block': { zone: 'senior_zone', coord: [400, 350], defaultMeetingSpot: '7-Block Common Area' },
  '8-Block': { zone: 'senior_zone', coord: [430, 360], defaultMeetingSpot: '8-Block Common Area' },
  '9-Block': { zone: 'senior_zone', coord: [460, 370], defaultMeetingSpot: '9-Block Common Area' },
  '10-Block': { zone: 'senior_zone', coord: [490, 380], defaultMeetingSpot: '10-Block Common Area' },
  '11-Block': { zone: 'senior_zone', coord: [520, 390], defaultMeetingSpot: '11-Block Common Area' },
  'PG Hostel': { zone: 'pg_zone', coord: [300, 500], defaultMeetingSpot: 'PG Hostel Reception' },
  'Day Scholar': { zone: 'off_campus', coord: [0, 0], defaultMeetingSpot: 'Campus Main Gate / Admin Building' },
};

/**
 * Check if two hostel names match.
 */
export function isSameHostel(hostelA?: string | null, hostelB?: string | null): boolean {
  if (!hostelA || !hostelB) return false;
  return hostelA.trim().toLowerCase() === hostelB.trim().toLowerCase();
}

/**
 * Calculate approximate walking distance (in meters) between two campus hostels.
 * Same hostel returns 0.
 * In future phases, this can be linked with Dijkstra/A* path distance over campus paths.
 */
export function calculateHostelDistance(hostelA?: string | null, hostelB?: string | null): number {
  if (!hostelA || !hostelB) return 500; // default average campus walk
  if (isSameHostel(hostelA, hostelB)) return 0;

  const locA = HOSTEL_LOCATIONS[hostelA];
  const locB = HOSTEL_LOCATIONS[hostelB];

  if (!locA || !locB) return 400;

  // Euclidean distance between relative campus grid coordinates
  const dx = locA.coord[0] - locB.coord[0];
  const dy = locA.coord[1] - locB.coord[1];
  const straightLine = Math.round(Math.sqrt(dx * dx + dy * dy));

  // Add 20% campus walking path coefficient for actual walking route
  return Math.round(straightLine * 1.2);
}

/**
 * Recommends the most convenient meetup/handover location.
 * - Same hostel: directly inside or in front of the hostel common area (0 walk distance).
 * - Different hostels: midpoint location like SAC, Central Food Court, or Nescafe Circle.
 */
export function getSuggestedHandoverSpot(
  buyerHostel?: string | null,
  sellerHostel?: string | null
): HandoverSpot {
  if (buyerHostel && sellerHostel && isSameHostel(buyerHostel, sellerHostel)) {
    return {
      name: `${sellerHostel} Common Lounge / Ground Floor`,
      description: `Both of you reside in ${sellerHostel}. Handover can happen right downstairs without leaving your block!`,
      landmarkType: 'hostel_common_area',
      approxDistanceMeters: 0,
    };
  }

  if (buyerHostel === 'Day Scholar' || sellerHostel === 'Day Scholar') {
    return {
      name: 'Main Campus Gate / Administrative Circle',
      description: 'Convenient campus transit point for day scholars and hostelers.',
      landmarkType: 'campus_gate',
      approxDistanceMeters: 300,
    };
  }

  return {
    name: 'Student Activity Centre (SAC) / Nescafe Circle',
    description: 'Central campus meetup spot roughly midpoint between campus hostel blocks.',
    landmarkType: 'campus_midpoint',
    approxDistanceMeters: calculateHostelDistance(buyerHostel, sellerHostel),
  };
}

/**
 * Partitions a list of products into:
 * 1. `sameHostel`: items listed by sellers residing in the viewer's hostel block (shown first & separately).
 * 2. `otherHostels`: items listed from all other hostels or items with unspecified hostels.
 */
export function separateProductsByHostel<T extends { seller_hostel_block?: string | null }>(
  products: T[],
  viewerHostel?: string | null
): { sameHostel: T[]; otherHostels: T[] } {
  if (!viewerHostel) {
    return {
      sameHostel: [],
      otherHostels: products,
    };
  }

  const sameHostel: T[] = [];
  const otherHostels: T[] = [];

  for (const product of products) {
    if (isSameHostel(product.seller_hostel_block, viewerHostel)) {
      sameHostel.push(product);
    } else {
      otherHostels.push(product);
    }
  }

  return { sameHostel, otherHostels };
}
