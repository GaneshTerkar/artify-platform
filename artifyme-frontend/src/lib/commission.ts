export interface CommissionSplit {
  artistPercentage: number;
  deliveryPercentage: number;
  platformPercentage: number;
}

export const DEFAULT_COMMISSION_SPLIT: CommissionSplit = {
  artistPercentage: 70,
  deliveryPercentage: 10,
  platformPercentage: 20,
};

export function getCommissionSplit(): CommissionSplit {
  try {
    const saved = localStorage.getItem("artifyme_commission_split");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed.artistPercentage === "number" &&
        typeof parsed.deliveryPercentage === "number" &&
        typeof parsed.platformPercentage === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_COMMISSION_SPLIT;
}
