export const CATEGORIES = [
  { name: 'Books', slug: 'books', icon: 'BookOpen' },
  { name: 'Electronics', slug: 'electronics', icon: 'Laptop' },
  { name: 'Engineering Instruments', slug: 'engineering-instruments', icon: 'Ruler' },
  { name: 'Hostel Items', slug: 'hostel-items', icon: 'Bed' },
  { name: 'Cycles', slug: 'cycles', icon: 'Bike' },
  { name: 'Furniture', slug: 'furniture', icon: 'Armchair' },
  { name: 'Clothing', slug: 'clothing', icon: 'Shirt' },
  { name: 'Stationery', slug: 'stationery', icon: 'PenTool' },
  { name: 'Other', slug: 'other', icon: 'Package' },
] as const;

export const CONDITIONS = [
  { label: 'Brand New', value: 'brand_new' },
  { label: 'Like New', value: 'like_new' },
  { label: 'Good', value: 'good' },
  { label: 'Fair', value: 'fair' },
  { label: 'Needs Repair', value: 'needs_repair' },
] as const;

export const PRODUCT_STATUSES = [
  { label: 'Active', value: 'active' },
  { label: 'Reserved', value: 'reserved' },
  { label: 'Sold', value: 'sold' },
  { label: 'Removed', value: 'removed' },
] as const;

export const BRANCHES = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Electrical Engineering',
  'Chemical Engineering',
  'Metallurgical & Materials Engineering',
  'Bio Technology',
  'Other',
] as const;

export const YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year (Dual Degree)',
  'Alumni',
] as const;

export const HOSTEL_BLOCKS = [
  '1-Block',
  '2-Block',
  '3-Block',
  '4-Block',
  '5-Block',
  '6-Block',
  '7-Block',
  '8-Block',
  '9-Block',
  '10-Block',
  '11-Block',
  'PG Hostel',
  'Day Scholar',
] as const;

export const ALLOWED_EMAIL_DOMAIN = 'nittwrangal.ac.in';
export const ALT_EMAIL_DOMAIN = 'nitw.ac.in';

export function isNitwEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === ALLOWED_EMAIL_DOMAIN || domain === ALT_EMAIL_DOMAIN;
}

export function getCategoryName(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

export function getConditionLabel(value: string): string {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}
