export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Returns [newRatingA, newRatingB]. scoreA: 1 win, 0.5 draw, 0 loss. */
export function updateRatings(ratingA: number, ratingB: number, scoreA: number, k = 32): [number, number] {
  const ea = expectedScore(ratingA, ratingB);
  const eb = 1 - ea;
  return [
    Math.round(ratingA + k * (scoreA - ea)),
    Math.round(ratingB + k * ((1 - scoreA) - eb)),
  ];
}
