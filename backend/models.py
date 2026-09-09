from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class StationNode(BaseModel):
    code: str
    name: str
    km: float
    has_siding: bool = True
    loop_lines: int = 2
    platform_count: int = 2

class TrackSegment(BaseModel):
    segment_id: str
    from_station: str
    to_station: str
    length_km: float
    max_speed_kmph: float
    capacity: int = 3
    electrified: bool = True
    signaling: str = "Automatic Block"

class TrackNetwork(BaseModel):
    Corridor_Name: str
    Zone: str
    Division: str
    Total_Length_Km: float
    Station_Nodes: List[StationNode]
    Track_Segments: List[TrackSegment]
    Safety_Headway_Minutes: int = 7
    Default_Loop_Hold_Station: str = "ORAI"

class TrainSchedule(BaseModel):
    Train_ID: str
    Train_Name: str
    Train_Type: str = "Express"
    Priority_Rank: int = 2  # 1: Vande Bharat / Rajdhani, 2: Mail/Express, 3: Passenger, 4: Freight
    Departure_Time: str     # e.g. "14:10"
    Route_Stations: str     # "CNB,BZM,PHN,KPI,ORAI,AIT,MOTH,CGN,JHS"
    Average_Speed: float    # km/h

class BlockRequest(BaseModel):
    Request_ID: str = "REQ-BLK-101"
    Department: str = "Track Engineering"  # "Track Engineering", "Traction / OHE", "Signal & Telecom (S&T)"
    Segment_ID: str = "KPI-ORAI"
    Required_Duration_Mins: int = 180
    Preferred_Window_Start: str = "14:00"
    Priority: str = "High"  # "Low", "Medium", "High", "Critical"

class TrainTrajectoryPoint(BaseModel):
    station_code: str
    station_name: str
    km: float
    arrival_min: float
    departure_min: float
    arrival_time_str: str
    departure_time_str: str
    hold_duration_mins: float = 0.0
    is_siding_hold: bool = False

class SidingHoldDetail(BaseModel):
    train_id: str
    train_name: str
    station_code: str
    station_name: str
    start_time_str: str
    end_time_str: str
    hold_duration_mins: int
    reason: str

class SolvedTrainResult(BaseModel):
    train_id: str
    train_name: str
    train_type: str
    priority_rank: int
    baseline_arrival_mins: float
    solved_arrival_mins: float
    total_delay_mins: float
    baseline_trajectory: List[TrainTrajectoryPoint]
    solved_trajectory: List[TrainTrajectoryPoint]
    siding_holds: List[SidingHoldDetail] = []
    status: str = "ON_TIME"  # "ON_TIME", "HELD_AT_SIDING", "DELAYED"

class BlockWindowResult(BaseModel):
    request_id: str
    department: str
    segment_id: str
    from_station: str
    to_station: str
    start_km: float
    end_km: float
    requested_start_mins: float
    granted_start_mins: float
    granted_end_mins: float
    requested_start_str: str
    granted_start_str: str
    granted_end_str: str
    duration_mins: int
    status: str = "GRANTED"  # "GRANTED", "MODIFIED", "REJECTED"

class OptimizationKPIs(BaseModel):
    total_delay_added_mins: int
    maintenance_block_duration_granted: int
    section_throughput_efficiency_pct: float
    safety_headway_compliance_pct: float = 100.0
    trains_on_time: int
    trains_held: int
    total_trains: int
    objective_score: float
    solver_time_sec: float

class OptimizationResponse(BaseModel):
    success: bool
    message: str
    kpis: OptimizationKPIs
    block_window: BlockWindowResult
    trains: List[SolvedTrainResult]
    network: TrackNetwork
    dispatch_notice_summary: str

class NLPExtractedBlockRequest(BaseModel):
    segment_id: Optional[str] = None
    from_station: Optional[str] = None
    to_station: Optional[str] = None
    duration_mins: int = 180
    start_time: str = "14:00"
    department: str = "Track Engineering"
    priority: str = "High"
    action_type: str = "GRANT_BLOCK"  # "GRANT_BLOCK", "POSTPONE_BLOCK", "CANCEL_BLOCK", "STATUS_QUERY"
    confidence: float = 0.95

class CopilotChatRequest(BaseModel):
    query: str
    current_block_request: Optional[BlockRequest] = None
    api_key: Optional[str] = None

class CopilotChatResponse(BaseModel):
    reply_text: str
    extracted_parameters: Optional[NLPExtractedBlockRequest] = None
    suggested_action: Optional[str] = None
    auto_trigger_solve: bool = False
    operational_rationale: List[str] = []
