import type {
  AgeStats,
  GeographicStats,
  DistanceStats,
  RegistrationStats,
  EventPerformanceStats,
  AttritionStats,
  ResultsDemographicsStats,
} from './types.ts';

export function ageInsights(stats: AgeStats): string[] {
  const insights: string[] = [];
  if (stats.median === null) return insights;

  if (stats.median >= 40) {
    insights.push(
      `Median age of ${stats.median} is on the higher end — recovery amenities, age-group award depth, and course character tend to resonate more with experienced fields like this.`,
    );
  } else if (stats.median <= 28) {
    insights.push(
      `Median age of ${stats.median} suggests a younger field. Newer athletes may appreciate clearer course guidance and pre-race training resources.`,
    );
  }

  if (stats.min !== null && stats.max !== null && stats.max - stats.min >= 45) {
    insights.push(
      `A ${stats.max - stats.min}-year age range (${stats.min}–${stats.max}) is unusually broad — multi-generational fields are rare and can be a compelling part of your event story.`,
    );
  }

  const totalFromBuckets = stats.buckets.reduce((s, b) => s + b.count, 0);
  if (totalFromBuckets > 0) {
    const peak = stats.buckets.reduce((a, b) => (b.count > a.count ? b : a));
    const peakPct = Math.round((peak.count / totalFromBuckets) * 100);
    if (peakPct >= 35) {
      insights.push(
        `The ${peak.label} age group accounts for ${peakPct}% of your field. A concentrated core demographic often drives strong peer-to-peer recruiting within that community.`,
      );
    }
  }

  return insights.slice(0, 3);
}

export function geographicInsights(stats: GeographicStats): string[] {
  const insights: string[] = [];
  const total = stats.usParticipants + stats.internationalParticipants;
  if (total === 0) return insights;

  if (stats.topStates.length > 0) {
    const top = stats.topStates[0];
    const topPct = Math.round((top.count / total) * 100);
    if (topPct >= 50) {
      insights.push(
        `${topPct}% of participants came from ${top.state} — a strong home-state draw. If regional or national growth is a goal, ambassador programs and cross-regional promotion can help extend reach.`,
      );
    }
  }

  const intlPct = Math.round((stats.internationalParticipants / total) * 100);
  if (intlPct >= 10) {
    insights.push(
      `${intlPct}% international participation suggests real destination appeal. These athletes often research events more thoroughly and may have higher expectations around logistics and overall experience quality.`,
    );
  } else if (stats.internationalParticipants > 0 && intlPct < 5) {
    insights.push(
      `A small but present international contingent (${stats.internationalParticipants} participants) — if growing this segment is of interest, connecting with international running communities and global race directories could help.`,
    );
  }

  const stateCount = Object.keys(stats.byState).length;
  if (stateCount >= 20) {
    insights.push(
      `Participants from ${stateCount} states — strong geographic diversity. Events that draw from many states often benefit from a vibrant mix of running cultures and traditions.`,
    );
  }

  return insights.slice(0, 3);
}

export function distanceInsights(stats: DistanceStats): string[] {
  const insights: string[] = [];
  const total = stats.local + stats.regional + stats.destination;
  if (total === 0) return insights;

  const localPct = Math.round((stats.local / total) * 100);
  const destPct = Math.round((stats.destination / total) * 100);

  if (localPct >= 65) {
    insights.push(
      `${localPct}% of participants are local (under 50 miles) — a strong community anchor. If broader regional reach is a goal, outreach to running clubs in nearby cities is often effective.`,
    );
  }

  if (destPct >= 20) {
    insights.push(
      `${destPct}% traveled over 200 miles — a meaningful destination draw. These participants often arrive with high expectations around the total experience, from check-in logistics to post-race atmosphere.`,
    );
  }

  if (stats.medianMiles >= 150) {
    insights.push(
      `Median travel distance of ${stats.medianMiles} miles points to a true destination event. Travel partnerships, extended early-registration windows, or travel-focused social content could help attract more athletes in this category.`,
    );
  } else if (stats.medianMiles <= 20) {
    insights.push(
      `Median travel distance of ${stats.medianMiles} miles — very local concentration. Parking, shuttle service, and local lodging partnerships may matter more here than for destination events.`,
    );
  }

  return insights.slice(0, 3);
}

export function registrationInsights(stats: RegistrationStats): string[] {
  const insights: string[] = [];

  if (stats.couponUsagePercent >= 20) {
    insights.push(
      `${stats.couponUsagePercent}% coupon usage is notable. It may be worth considering whether discounting is attracting new participants or primarily reducing revenue from athletes who would have signed up regardless.`,
    );
  }

  const { earlyProfile, lateProfile } = stats;
  if (earlyProfile.count > 0 && lateProfile.count > 0) {
    const ageDiff =
      earlyProfile.avgAge !== null && lateProfile.avgAge !== null
        ? Math.round(lateProfile.avgAge - earlyProfile.avgAge)
        : null;

    if (ageDiff !== null && Math.abs(ageDiff) >= 5) {
      if (ageDiff > 0) {
        insights.push(
          `Late registrants average ${ageDiff} years older than early registrants. Experienced athletes often wait longer to commit — early-bird incentives may not strongly influence this group's timing.`,
        );
      } else {
        insights.push(
          `Early registrants average ${Math.abs(ageDiff)} years older than late registrants. Newer runners may be more discovery-driven — consider where younger audiences find events and time your outreach accordingly.`,
        );
      }
    }

    const genderDiff = Math.abs(lateProfile.femalePercent - earlyProfile.femalePercent);
    if (genderDiff >= 10) {
      const moreFemaleLate = lateProfile.femalePercent > earlyProfile.femalePercent;
      const laterPct = moreFemaleLate ? lateProfile.femalePercent : earlyProfile.femalePercent;
      const earlierPct = moreFemaleLate ? earlyProfile.femalePercent : lateProfile.femalePercent;
      insights.push(
        `${moreFemaleLate ? 'Late' : 'Early'} registrants skew more female (${laterPct}% vs. ${earlierPct}%). This timing pattern could inform when gender-targeted outreach would have the most impact.`,
      );
    }

    if (
      earlyProfile.medianDistanceMiles !== null &&
      lateProfile.medianDistanceMiles !== null &&
      lateProfile.medianDistanceMiles - earlyProfile.medianDistanceMiles >= 50
    ) {
      insights.push(
        `Late registrants traveled a median ${lateProfile.medianDistanceMiles} miles vs. ${earlyProfile.medianDistanceMiles} miles for early registrants. Out-of-area participants may take longer to commit — an extended early-bird window could help capture them sooner.`,
      );
    }
  }

  return insights.slice(0, 3);
}

export function finishTimeInsights(events: EventPerformanceStats[]): string[] {
  const insights: string[] = [];
  const primary = events[0];
  if (!primary) return insights;

  const ft = primary.finishTime;
  if (!ft) return insights;

  const spreadRatio = ft.slowestSeconds / ft.fastestSeconds;
  if (spreadRatio >= 2.5) {
    insights.push(
      `A wide finish time spread — the last finisher took ${spreadRatio.toFixed(1)}× longer than the first. Aid station staffing and cutoff placement are worth reviewing to serve both competitive runners and the back of the pack.`,
    );
  }

  if (ft.medianSeconds > 0 && ft.meanSeconds / ft.medianSeconds >= 1.12) {
    insights.push(
      `Mean finish time is notably higher than the median, suggesting a tail of slower finishers. This is common with a challenging course or a field that includes many first-timers.`,
    );
  }

  const maleRow = ft.byGender.find(r => r.gender === 'M');
  const femaleRow = ft.byGender.find(r => r.gender === 'F');
  if (maleRow?.medianSeconds && femaleRow?.medianSeconds) {
    const gap = (femaleRow.medianSeconds - maleRow.medianSeconds) / maleRow.medianSeconds;
    if (gap >= 0.15) {
      const gapPct = Math.round(gap * 100);
      insights.push(
        `Female median finish time is ${gapPct}% higher than male. Tracking this gap year-over-year can reveal whether your field is becoming more competitive or more participatory overall.`,
      );
    }
  }

  return insights.slice(0, 3);
}

export function attritionInsights(attrition: AttritionStats): string[] {
  const insights: string[] = [];
  const overall = attrition.overall;
  if (overall.total === 0) return insights;

  // finishRate, dnfRate, dnsRate are stored as percentages (0–100)
  const finishPct = Math.round(overall.finishRate);

  if (overall.finishRate < 80) {
    insights.push(
      `A ${finishPct}% finish rate is lower than typical. DNF patterns often cluster around specific aid stations or course segments — post-race interviews or GPS data can help identify whether the course, conditions, or cutoffs are the main factor.`,
    );
  } else if (overall.finishRate >= 95) {
    insights.push(
      `A ${finishPct}% finish rate is very high — your field, course, and support systems appear well-matched. It may be worth considering whether cutoff times leave enough room to challenge competitive runners while still accommodating back-of-pack finishers.`,
    );
  }

  if (overall.dns > 0 && overall.dnf > overall.dns * 2) {
    insights.push(
      `DNFs significantly outnumber DNS — most attrition is happening on-course rather than before the start. This can point to mid-race difficulty, weather, aid station spacing, or a challenging section of the course.`,
    );
  }

  const maleRow = attrition.byGender.find(r => r.name === 'Male');
  const femaleRow = attrition.byGender.find(r => r.name === 'Female');
  if (maleRow && femaleRow && maleRow.total > 10 && femaleRow.total > 10) {
    const rateDiff = Math.abs(maleRow.finishRate - femaleRow.finishRate);
    if (rateDiff >= 8) {
      const higher = maleRow.finishRate > femaleRow.finishRate ? 'Male' : 'Female';
      const higherPct = Math.round(Math.max(maleRow.finishRate, femaleRow.finishRate));
      const lowerPct = Math.round(Math.min(maleRow.finishRate, femaleRow.finishRate));
      insights.push(
        `${higher} finishers have a notably higher completion rate (${higherPct}% vs. ${lowerPct}%). Understanding whether this reflects field experience levels, course characteristics, or something else could inform future participant communication.`,
      );
    }
  }

  return insights.slice(0, 3);
}

export function demographicsInsights(demographics: ResultsDemographicsStats): string[] {
  const insights: string[] = [];

  // Median age shift from all entrants to finishers
  const entrantMedian = demographics.age.median;
  const finisherMedian = demographics.finisherAge.median;
  if (entrantMedian !== null && finisherMedian !== null) {
    const diff = finisherMedian - entrantMedian;
    if (diff >= 3) {
      insights.push(
        `Finishers have a median age ${diff} years higher than all entrants (${finisherMedian} vs. ${entrantMedian}). Older participants finishing at higher rates is common in events where experience and pacing strategy matter more than raw fitness.`,
      );
    } else if (diff <= -3) {
      insights.push(
        `Finishers skew ${Math.abs(diff)} years younger than the full entrant field (${finisherMedian} vs. ${entrantMedian}). This could suggest your course rewards fitness over experience, or that younger participants are more likely to make it to the start line.`,
      );
    }
  }

  // Age group completion rates from byGenderAndAge
  const groups = demographics.byGenderAndAge.filter(r => r.total >= 5);
  if (groups.length > 1) {
    const withRates = groups.map(r => ({
      label: r.ageGroup,
      finishRate: (r.maleFinishCount + r.femaleFinishCount) / r.total,
      total: r.total,
    }));

    const totalEntrants = withRates.reduce((s, r) => s + r.total, 0);
    const totalFinishers = groups.reduce((s, r) => s + r.maleFinishCount + r.femaleFinishCount, 0);
    const overallRate = totalEntrants > 0 ? totalFinishers / totalEntrants : 0;

    const lowest = withRates.reduce((a, b) => (b.finishRate < a.finishRate ? b : a));
    if (overallRate - lowest.finishRate >= 0.10) {
      insights.push(
        `The ${lowest.label} age group has a notably lower completion rate (${Math.round(lowest.finishRate * 100)}%) compared to the field overall (${Math.round(overallRate * 100)}%). Course difficulty, cutoff timing, or preparation patterns may affect this group differently.`,
      );
    }

    const highest = withRates.reduce((a, b) => (b.finishRate > a.finishRate ? b : a));
    if (highest.label !== lowest.label && highest.finishRate - overallRate >= 0.10) {
      insights.push(
        `The ${highest.label} age group has the strongest completion rate at ${Math.round(highest.finishRate * 100)}% vs. ${Math.round(overallRate * 100)}% overall — understanding what this group does differently could inform your pre-race communications.`,
      );
    }
  }

  return insights.slice(0, 3);
}
