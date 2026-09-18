/**
 * Hacker-News style time decay.
 *
 *   score = (votes + 0.5 * comments + 1) / (hoursSincePost + 2)^1.5
 *
 * A post with 40 votes from last month should not outrank a post with 12 votes
 * from this morning, otherwise the feed freezes and new ideas are never seen.
 * Exported as a pure function so it can be unit tested, and mirrored as a
 * MongoDB aggregation stage so ranking happens in the database rather than by
 * loading every post into Node.
 */
export function trendingScore(votes: number, comments: number, hoursSincePost: number): number {
  const gravity = 1.5;
  const engagement = votes + 0.5 * comments + 1;
  return engagement / Math.pow(Math.max(hoursSincePost, 0) + 2, gravity);
}

/** The same formula, expressed for the aggregation pipeline. */
export const trendingScoreStage = {
  $addFields: {
    trendingScore: {
      $divide: [
        { $add: ['$voteCount', { $multiply: ['$commentCount', 0.5] }, 1] },
        {
          $pow: [
            { $add: [{ $dateDiff: { startDate: '$createdAt', endDate: '$$NOW', unit: 'hour' } }, 2] },
            1.5,
          ],
        },
      ],
    },
  },
};
