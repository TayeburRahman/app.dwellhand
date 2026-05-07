import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLADBSLink(permitNumber: string, existingLink?: string) {
  if (existingLink) return existingLink;
  if (!permitNumber) return '';
  
  // LADBS URL pattern expects id1, id2, id3 from permit number parts (e.g. 24010-20000-03941)
  const parts = permitNumber.split('-');
  if (parts.length >= 3) {
    return `https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=${parts[0]}&id2=${parts[1]}&id3=${parts[2]}`;
  }
  
  // Fallback if not hyphenated (e.g. 15-digit string)
  if (permitNumber.length === 15) {
    return `https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=${permitNumber.substring(0, 5)}&id2=${permitNumber.substring(5, 10)}&id3=${permitNumber.substring(10, 15)}`;
  }

  return `https://www.ladbsservices2.lacity.org/OnlineServices/PermitReport/PcisPermitDetail?id1=${permitNumber}`;
}
