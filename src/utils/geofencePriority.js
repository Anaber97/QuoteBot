export function selectHighestPriorityZones(zones = []) {
  if (!Array.isArray(zones) || zones.length === 0) return [];

  let highestPriority = Number.NEGATIVE_INFINITY;
  for (const zone of zones) {
    const priority = Number(zone?.priority);
    highestPriority = Math.max(highestPriority, Number.isFinite(priority) ? priority : 0);
  }

  return zones.filter((zone) => {
    const priority = Number(zone?.priority);
    return (Number.isFinite(priority) ? priority : 0) === highestPriority;
  });
}
