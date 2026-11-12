window.gagunTrafficDemand = (() => {
  const reference = window.gagunTrafficCityData;
  const defaults = { population: reference.population, fleet: reference.passengerCars, tripsPerResident: 2 };
  const bounds = { population: [0, 150000], fleet: [0, 120000], tripsPerResident: [0, 4], rain: [0, 100] };
  const holidays = new Set(["2026-11-11", "2026-12-24", "2026-12-25", "2026-12-26"]);
  const bell = (hour, center, width) => Math.exp(-.5 * ((hour - center) / width) ** 2);
  function cycle(hour, workingDay) {
    const daylight = 1 / (1 + Math.exp(-(hour - 5.3) * 1.6)) / (1 + Math.exp((hour - 22) * 1.2));
    const morning = bell(hour, 7.5, .8), afternoon = bell(hour, 16, 1.0);
    let multiplier = .16 + .84 * daylight;
    let phase = daylight < .4 ? "night" : "offPeak";
    if (workingDay) {
      multiplier += .95 * morning + .85 * afternoon;
      if (morning > .45) phase = "morningPeak";
      else if (afternoon > .45) phase = "afternoonPeak";
    } else {
      multiplier *= .68 + .15 * bell(hour, 13, 2.5);
      if (daylight >= .4) phase = "nonWorkingDay";
    }
    return { multiplier, phase };
  }
  const cycleHours = [true, false].map(workingDay => Array.from({ length: 1440 }, (_, minute) => cycle((minute + .5) / 60, workingDay).multiplier / 60).reduce((a, b) => a + b, 0));

  function allocate(total, shares) {
    const exact = shares.map(share => total * share), counts = exact.map(Math.floor);
    const order = shares.map((share, i) => i).filter(i => shares[i] > 0).sort((a, b) => (exact[b] - counts[b]) - (exact[a] - counts[a]) || a - b);
    const remaining = total - counts.reduce((sum, n) => sum + n, 0);
    for (let i = 0; i < remaining; i++) counts[order[i % order.length]]++;
    return counts;
  }

  function profile({ time, date, population = defaults.population, fleet = defaults.fleet, tripsPerResident = defaults.tripsPerResident, rain = 0, dailyCycle = true, busAvailable = true }) {
    const wet = Math.max(0, Math.min(1, rain / 100));
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const workingDay = day !== 0 && day !== 6 && !holidays.has(date);
    const { multiplier, phase } = dailyCycle ? cycle(time / 3600, workingDay) : { multiplier: 1, phase: "offPeak" };
    const baseRate = population * tripsPerResident / (dailyCycle ? cycleHours[0] : 24);
    const dailyTrips = Math.round(baseRate * (dailyCycle ? cycleHours[workingDay ? 0 : 1] : 24));
    const fleetRatio = population > 0 ? fleet / population / (reference.passengerCars / reference.population) : 0;
    const dryCarShare = Math.max(0, Math.min(.85, .55 * fleetRatio));
    const dryWalkShare = (1 - dryCarShare) * 22 / 45;
    const dryBikeShare = (1 - dryCarShare) * 6 / 45;
    const dryScooterShare = (1 - dryCarShare) * 2 / 45;
    const displacedWalkers = dryWalkShare * .75 * wet;
    const displacedRiders = dryBikeShare * .8 * wet + dryScooterShare * .9 * wet;
    let carShare = dryCarShare + (displacedWalkers + displacedRiders) * .55 * Math.min(1, fleetRatio);
    let walkShare = dryWalkShare - displacedWalkers;
    let bikeShare = dryBikeShare * (1 - .8 * wet), scooterShare = dryScooterShare * (1 - .9 * wet);
    let busShare = 1 - carShare - walkShare - bikeShare - scooterShare;
    if (!busAvailable) {
      const available = carShare + walkShare + bikeShare + scooterShare;
      carShare /= available; walkShare /= available; bikeShare /= available; scooterShare /= available; busShare = 0;
    }
    const total = Math.round(baseRate * multiplier);
    const shares = [carShare, walkShare, busShare, bikeShare, scooterShare];
    const [car, walk, bus, bike, scooter] = allocate(total, shares);
    return { total, car, walk, bus, bike, scooter, baseRate, dailyTrips, carsPerThousand: population > 0 ? fleet / population * 1000 : 0, shares, multiplier, phase, wet, workingDay };
  }
  return { profile, defaults, bounds, allocate };
})();
