import json
import csv
from backend.models import TrackNetwork, TrainSchedule, BlockRequest
from backend.solver import RailwayBlockOptimizer

def test_solver_execution():
    with open("data/track_network.json", "r") as f:
        net_dict = json.load(f)
    network = TrackNetwork(**net_dict)

    trains = []
    with open("data/train_schedules.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            trains.append(TrainSchedule(
                Train_ID=row["Train_ID"],
                Train_Name=row["Train_Name"],
                Train_Type=row["Train_Type"],
                Priority_Rank=int(row["Priority_Rank"]),
                Departure_Time=row["Departure_Time"],
                Route_Stations=row["Route_Stations"],
                Average_Speed=float(row["Average_Speed"])
            ))

    block_req = BlockRequest(
        Request_ID="REQ-BLK-101",
        Department="Track Engineering",
        Segment_ID="KPI-ORAI",
        Required_Duration_Mins=180,
        Preferred_Window_Start="14:00",
        Priority="High"
    )

    optimizer = RailwayBlockOptimizer(network, trains)
    res = optimizer.solve_block_allocation(block_req)

    print("Success:", res.success)
    print("KPIs:", res.kpis.model_dump())
    print("Block Window Granted:", res.block_window.granted_start_str, "to", res.block_window.granted_end_str)
    print("Trains evaluated:", len(res.trains))
    for t in res.trains:
        print(f"Train {t.train_id} ({t.train_name}) [P{t.priority_rank}]: Delay={t.total_delay_mins}m, Status={t.status}")
        for hold in t.siding_holds:
            print(f"  -> Siding Hold at {hold.station_name}: {hold.hold_duration_mins}m ({hold.start_time_str} to {hold.end_time_str})")

    assert res.success is True
    assert res.kpis.maintenance_block_duration_granted == 180
    assert res.kpis.safety_headway_compliance_pct == 100.0
    print("--- ALL SOLVER ASSERTIONS PASSED! ---")

if __name__ == "__main__":
    test_solver_execution()
