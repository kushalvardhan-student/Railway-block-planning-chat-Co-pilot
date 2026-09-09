import os
from typing import Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, PlainTextResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.models import (
    BlockRequest, OptimizationResponse, CopilotChatRequest, CopilotChatResponse
)
from backend.data_manager import RailwayDataManager
from backend.solver import RailwayBlockOptimizer
from backend.nlp_copilot import RailwayNLPCopilot
from backend.dispatch_notice import DispatchNoticeGenerator

app = FastAPI(
    title="AI-Powered Automatic Railway Block Planning Copilot",
    description="Enterprise Railway Section Controller Dashboard & OR-Tools CP-SAT Solver for Indian Railways",
    version="2.0.0"
)

# Enable CORS for flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory state
data_mgr = RailwayDataManager()
copilot = RailwayNLPCopilot(data_mgr.network)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

@app.on_event("startup")
def startup_event():
    # Pre-run baseline optimization so app loads with live solved data immediately
    opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
    data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)

@app.get("/api/data/status")
def get_system_status():
    """Return current network, trains, active block, and last solution."""
    return {
        "network": data_mgr.network,
        "trains": data_mgr.trains,
        "block_requests": data_mgr.block_requests,
        "active_block_request": data_mgr.active_block_request,
        "last_result": data_mgr.last_optimization_result
    }

@app.post("/api/optimize", response_model=OptimizationResponse)
def run_optimization(block_req: Optional[BlockRequest] = None):
    """Run Google OR-Tools CP-SAT solver on current network and block request."""
    if block_req:
        data_mgr.active_block_request = block_req
    else:
        block_req = data_mgr.active_block_request

    optimizer = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
    result = optimizer.solve_block_allocation(block_req)
    data_mgr.last_optimization_result = result
    return result

@app.post("/api/copilot/chat", response_model=CopilotChatResponse)
async def chat_with_copilot(req: CopilotChatRequest):
    """Process natural language section controller queries."""
    res = await copilot.process_chat(req)
    
    # If a block command was extracted, update active block request
    if res.extracted_parameters and res.extracted_parameters.segment_id:
        p = res.extracted_parameters
        data_mgr.active_block_request = BlockRequest(
            Request_ID=f"REQ-AI-{int(os.times().system * 100) % 900 + 100}",
            Department=p.department,
            Segment_ID=p.segment_id,
            Required_Duration_Mins=p.duration_mins,
            Preferred_Window_Start=p.start_time,
            Priority=p.priority
        )
        if res.auto_trigger_solve:
            opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
            data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)

    return res

@app.post("/api/data/scenario/{scenario_id}", response_model=OptimizationResponse)
def select_scenario(scenario_id: str):
    """Switch to a preset operational scenario and re-solve."""
    req = data_mgr.set_preset_scenario(scenario_id)
    opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
    res = opt.solve_block_allocation(req)
    data_mgr.last_optimization_result = res
    return res

@app.post("/api/data/reset")
def reset_to_defaults():
    """Reset dataset to default North Central Railway corridor."""
    data_mgr.load_defaults()
    opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
    data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)
    return {"status": "success", "message": "Corridor reset to default NCR CNB-JHS section."}

@app.post("/api/data/upload")
async def upload_dataset(
    file_type: str = Form(...),  # 'schedules', 'network', or 'blocks'
    file: UploadFile = File(...)
):
    """Upload custom CSV or JSON dataset."""
    contents = (await file.read()).decode("utf-8")
    
    if file_type == "schedules":
        count = data_mgr.ingest_train_schedules_csv(contents)
        msg = f"Successfully ingested {count} train schedules from {file.filename}."
    elif file_type == "network":
        data_mgr.ingest_track_network_json(contents)
        msg = f"Successfully updated track network topology from {file.filename}."
    elif file_type == "blocks":
        count = data_mgr.ingest_block_requests_csv(contents)
        msg = f"Successfully ingested {count} block requests from {file.filename}."
    else:
        raise HTTPException(status_code=400, detail="Invalid file_type")

    # Re-solve automatically with new data
    opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
    data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)
    
    return {"status": "success", "message": msg, "last_result": data_mgr.last_optimization_result}

@app.get("/api/data/sample/{filename}")
def download_sample_file(filename: str):
    """Download default sample datasets."""
    content = data_mgr.get_sample_file_content(filename)
    if not content:
        raise HTTPException(status_code=404, detail="File not found")
    media_type = "application/json" if filename.endswith(".json") else "text/csv"
    return PlainTextResponse(content, media_type=media_type, headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })

@app.get("/api/notice/text")
def get_notice_text():
    """Generate and return plain text T/409 Operational Memo."""
    if not data_mgr.last_optimization_result:
        opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
        data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)
    
    text = DispatchNoticeGenerator.generate_text_notice(data_mgr.last_optimization_result)
    return PlainTextResponse(text, headers={
        "Content-Disposition": "attachment; filename=T409_Block_Caution_Order.txt"
    })

@app.get("/api/notice/html")
def get_notice_html():
    """Generate printable HTML T/409 Operational Memo."""
    if not data_mgr.last_optimization_result:
        opt = RailwayBlockOptimizer(data_mgr.network, data_mgr.trains)
        data_mgr.last_optimization_result = opt.solve_block_allocation(data_mgr.active_block_request)
        
    return HTMLResponse(DispatchNoticeGenerator.generate_html_notice(data_mgr.last_optimization_result))

# Mount static files
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
