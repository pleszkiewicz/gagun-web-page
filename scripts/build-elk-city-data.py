"""Freeze the GUS population/fleet baseline using Python's standard library only."""

import argparse
from datetime import date
import json
from pathlib import Path
import urllib.request

YEAR = 2025
CITY = "042815505011"
COUNTY = "042815505000"
QUERIES = {
    "cityPopulation": (CITY, 72305),
    "countyPopulation": (COUNTY, 72305),
    "countyPassengerCars": (COUNTY, 32561),
}


def source_url(unit, variable):
    return f"https://bdl.stat.gov.pl/api/v1/data/by-unit/{unit}?var-id={variable}&year={YEAR}&format=json"


def baseline(snapshot):
    values, sources = {}, {}
    for name, (unit, variable) in QUERIES.items():
        response = snapshot["series"][name]
        if response["unitId"] != unit:
            raise ValueError(f"Wrong territorial unit for {name}")
        result = next(r for r in response["results"] if r["id"] == variable)
        observation = next(v for v in result["values"] if v["year"] == str(YEAR))
        value = observation["val"]
        if observation["attrId"] != 1 or not isinstance(value, (int, float)) or value <= 0 or int(value) != value:
            raise ValueError(f"Missing or qualified observation for {name}")
        values[name] = int(value)
        sources[name] = {"url": source_url(unit, variable), "unitId": unit, "variableId": variable, "lastUpdate": result["lastUpdate"]}
    return {
        "version": 1,
        "asOf": f"{YEAR}-12-31",
        "retrieved": snapshot["retrieved"],
        "population": values["cityPopulation"],
        "passengerCars": round(values["cityPopulation"] * values["countyPassengerCars"] / values["countyPopulation"]),
        "passengerCarsEstimated": True,
        "county": {"population": values["countyPopulation"], "passengerCars": values["countyPassengerCars"]},
        "sources": sources,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Fetch the 2025 observations from the official GUS API")
    parser.add_argument("--source", type=Path, default=Path("assets/traffic/gus-2025.json"))
    parser.add_argument("--output", type=Path, default=Path("assets/traffic/city-data.js"))
    args = parser.parse_args()
    if args.refresh:
        snapshot = {"publisher": "Statistics Poland / GUS, Bank Danych Lokalnych", "retrieved": date.today().isoformat(), "series": {}}
        for name, (unit, variable) in QUERIES.items():
            with urllib.request.urlopen(source_url(unit, variable), timeout=30) as response:
                snapshot["series"][name] = json.load(response)
        baseline(snapshot)
        args.source.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    else:
        snapshot = json.loads(args.source.read_text())
    data = baseline(snapshot)
    args.output.write_text("window.gagunTrafficCityData = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n")
    print(json.dumps({"population": data["population"], "estimatedPassengerCars": data["passengerCars"], "asOf": data["asOf"]}))


if __name__ == "__main__":
    main()
