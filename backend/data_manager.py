import os
import json
import csv
import io
from typing import List, Dict, Any, Optional
from backend.models import TrackNetwork, TrainSchedule, BlockRequest, OptimizationResponse

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

class RailwayDataManager:
    """
    Manages in-memory railway datasets, CSV/JSON file ingestion,
    sample generation, and preset operational scenarios.
    """
    def __init__(self):
        self.network: Optional[TrackNetwork] = None
        self.trains: List[TrainSchedule] = []
        self.block_requests: List[BlockRequest] = []
        self.active_block_request: Optional[BlockRequest] = None
        self.last_optimization_result: Optional[OptimizationResponse] = None
        self.load_defaults()

    def load_defaults(self):
        """Load default North Central Railway CNB-JHS data."""
        # 1. Track Network
        net_path = os.path.join(DATA_DIR, "track_network.json")
        with open(net_path, "r", encoding="utf-8") as f:
            net_dict = json.load(f)
        self.network = TrackNetwork(**net_dict)

        # 2. Train Schedules
        train_path = os.path.join(DATA_DIR, "train_schedules.csv")
        self.trains = []
        with open(train_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Train_ID"):
                    self.trains.append(TrainSchedule(
                        Train_ID=str(row["Train_ID"]).strip(),
                        Train_Name=str(row["Train_Name"]).strip(),
                        Train_Type=str(row.get("Train_Type", "Express")).strip(),
                        Priority_Rank=int(row.get("Priority_Rank", 2)),
                        Departure_Time=str(row["Departure_Time"]).strip(),
                        Route_Stations=str(row["Route_Stations"]).strip(),
                        Average_Speed=float(row.get("Average_Speed", 75))
                    ))

        # 3. Block Requests
        block_path = os.path.join(DATA_DIR, "block_requests.csv")
        self.block_requests = []
        with open(block_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Request_ID"):
                    self.block_requests.append(BlockRequest(
                        Request_ID=str(row["Request_ID"]).strip(),
                        Department=str(row.get("Department", "Track Engineering")).strip(),
                        Segment_ID=str(row.get("Segment_ID", "KPI-ORAI")).strip(),
                        Required_Duration_Mins=int(row.get("Required_Duration_Mins", 180)),
                        Preferred_Window_Start=str(row.get("Preferred_Window_Start", "14:00")).strip(),
                        Priority=str(row.get("Priority", "High")).strip()
                    ))
        
        self.active_block_request = self.block_requests[0] if self.block_requests else BlockRequest()

    def ingest_train_schedules_csv(self, csv_content: str) -> int:
        """Parse and update train schedules from CSV string."""
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        new_trains = []
        for raw_row in reader:
            row = {k.strip(): v for k, v in raw_row.items() if k}
            t_id = row.get("Train_ID") or row.get("train_id") or row.get("Train No") or row.get("Train_No")
            if t_id:
                new_trains.append(TrainSchedule(
                    Train_ID=str(t_id).strip(),
                    Train_Name=str(row.get("Train_Name") or row.get("train_name") or t_id).strip(),
                    Train_Type=str(row.get("Train_Type") or row.get("train_type") or "Express").strip(),
                    Priority_Rank=int(row.get("Priority_Rank") or row.get("priority_rank") or 2),
                    Departure_Time=str(row.get("Departure_Time") or row.get("departure_time") or "14:00").strip(),
                    Route_Stations=str(row.get("Route_Stations") or row.get("route_stations") or "CNB,BZM,PHN,KPI,ORAI,AIT,MOTH,CGN,JHS").strip(),
                    Average_Speed=float(row.get("Average_Speed") or row.get("average_speed") or 75.0)
                ))
        if new_trains:
            self.trains = new_trains
        return len(new_trains)

    def ingest_track_network_json(self, json_content: str) -> bool:
        """Parse and update track network from JSON string."""
        data = json.loads(json_content)
        self.network = TrackNetwork(**data)
        return True

    def ingest_block_requests_csv(self, csv_content: str) -> int:
        """Parse and update block requests from CSV string."""
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        new_blocks = []
        for row in reader:
            if row.get("Request_ID"):
                new_blocks.append(BlockRequest(
                    Request_ID=str(row["Request_ID"]).strip(),
                    Department=str(row.get("Department", "Track Engineering")).strip(),
                    Segment_ID=str(row.get("Segment_ID", "KPI-ORAI")).strip(),
                    Required_Duration_Mins=int(row.get("Required_Duration_Mins", 180)),
                    Preferred_Window_Start=str(row.get("Preferred_Window_Start", "14:00")).strip(),
                    Priority=str(row.get("Priority", "High")).strip()
                ))
        if new_blocks:
            self.block_requests = new_blocks
            self.active_block_request = new_blocks[0]
        return len(new_blocks)

    def set_preset_scenario(self, scenario_id: str) -> BlockRequest:
        """Switch to a specific operational maintenance scenario."""
        scenarios = {
            "track_renewal_180": BlockRequest(
                Request_ID="REQ-SCN-01",
                Department="Track Engineering",
                Segment_ID="KPI-ORAI",
                Required_Duration_Mins=180,
                Preferred_Window_Start="14:00",
                Priority="High"
            ),
            "ohe_wire_120": BlockRequest(
                Request_ID="REQ-SCN-02",
                Department="Traction / OHE",
                Segment_ID="ORAI-AIT",
                Required_Duration_Mins=120,
                Preferred_Window_Start="11:30",
                Priority="Medium"
            ),
            "signal_testing_90": BlockRequest(
                Request_ID="REQ-SCN-03",
                Department="Signal & Telecom (S&T)",
                Segment_ID="BZM-PHN",
                Required_Duration_Mins=90,
                Preferred_Window_Start="16:00",
                Priority="Medium"
            ),
            "emergency_fracture_60": BlockRequest(
                Request_ID="REQ-SCN-04",
                Department="Track Safety Emergency",
                Segment_ID="AIT-MOTH",
                Required_Duration_Mins=60,
                Preferred_Window_Start="15:00",
                Priority="Critical"
            )
        }
        req = scenarios.get(scenario_id, scenarios["track_renewal_180"])
        self.active_block_request = req
        return req

    def get_sample_file_content(self, filename: str) -> str:
        """Return raw content of a sample dataset."""
        path = os.path.join(DATA_DIR, filename)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return ""
