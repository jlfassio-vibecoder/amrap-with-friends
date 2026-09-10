import { estimateSegmentResultsFanOut } from '../src/lib/realtime/segmentResultsFanOut';

const EVENTS_PER_MISSION = 5;

console.log('Segment-results Realtime fan-out (offline model)');
console.log(`Assumes ${EVENTS_PER_MISSION} events per mission.`);
console.log('N missions | unfiltered (per client) | filtered mission_id=eq (per client)');
console.log('-----------|-------------------------|------------------------------------');

for (let n = 1; n <= 20; n += 1) {
  const { unfiltered, filtered } = estimateSegmentResultsFanOut(n, EVENTS_PER_MISSION);
  console.log(
    `${String(n).padStart(10)} | ${String(unfiltered).padStart(23)} | ${String(filtered).padStart(34)}`
  );
}

const sample = estimateSegmentResultsFanOut(10, EVENTS_PER_MISSION);
console.log('');
console.log(
  `At 10 concurrent missions: unfiltered=${sample.unfiltered}, filtered=${sample.filtered} (O(events in this mission)).`
);
