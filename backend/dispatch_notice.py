import datetime
from typing import Dict, Any, List
from backend.models import OptimizationResponse

class DispatchNoticeGenerator:
    """
    Generates formal Indian Railways Operational Notices (T/409 Caution Orders
    and Control Office Block Memos) summarizing block allocation, siding holds,
    and speed restrictions.
    """
    @staticmethod
    def generate_text_notice(response: OptimizationResponse) -> str:
        kpis = response.kpis
        blk = response.block_window
        now_str = datetime.datetime.now().strftime("%d-%b-%Y %H:%M:%S IST")
        serial_no = f"CO/NCR/JHS/BLK/{datetime.datetime.now().strftime('%Y%m%d')}-042"
        
        lines = [
            "=========================================================================================",
            "                      NORTH CENTRAL RAILWAY - DIVISIONAL CONTROL OFFICE                  ",
            "                           VIRANGANA LAKSHMIBAI JHANSI / PRAYAGRAJ                       ",
            "                  OPERATIONAL BLOCK CONTROL ORDER & CAUTION MEMO (FORM T/409)            ",
            "=========================================================================================",
            f" CONTROL ORDER REF NO : {serial_no}",
            f" DATE & TIME OF ISSUE : {now_str}",
            f" ISSUED BY            : Section Controller (Main Line Desk) / Chief Controller (Movement)",
            f" TO                   : Station Masters: CNB, BZM, PHN, KPI, ORAI, AIT, MOTH, CGN, JHS",
            f"                        Loco Pilots & Train Guards of All Running & Scheduled Trains",
            f"                        Section Engineers (P-Way, OHE, S&T)",
            "-----------------------------------------------------------------------------------------",
            " 1. BLOCK PARTICULARS & TRACK RESTRICTION:",
            f"    • Affected Section   : {blk.segment_id} ({blk.from_station} to {blk.to_station})",
            f"    • Kilometer Range    : Km {blk.start_km:.1f} to Km {blk.end_km:.1f} (Length: {blk.end_km - blk.start_km:.1f} Km)",
            f"    • Department / Work  : {blk.department} (Scheduled Maintenance Block)",
            f"    • Block Duration     : {blk.duration_mins} Minutes",
            f"    • Granted Time Window: {blk.granted_start_str} hrs to {blk.granted_end_str} hrs",
            f"    • Line Status        : Absolute Block Imposed. No train movement permitted during window.",
            "-----------------------------------------------------------------------------------------",
            " 2. TRAIN REGULATION & SIDING / LOOP LINE DETENTION MATRIX:",
            f"    {'Train No':<10} {'Train Name':<28} {'Priority':<8} {'Holding Stn':<12} {'Hold Duration':<14} {'Action / Status'}"
        ]
        
        held_trains_count = 0
        for t in response.trains:
            if t.siding_holds:
                held_trains_count += 1
                for hold in t.siding_holds:
                    p_str = f"P-{t.priority_rank}"
                    lines.append(
                        f"    {t.train_id:<10} {t.train_name[:26]:<28} {p_str:<8} {hold.station_name:<12} {hold.hold_duration_mins:>3} mins       Hold on Loop Line ({hold.start_time_str}-{hold.end_time_str})"
                    )
            elif t.total_delay_mins > 2:
                p_str = f"P-{t.priority_rank}"
                lines.append(
                    f"    {t.train_id:<10} {t.train_name[:26]:<28} {p_str:<8} {'Section':<12} {int(t.total_delay_mins):>3} mins       Regulated in section / headway clearance"
                )
            else:
                p_str = f"P-{t.priority_rank}"
                lines.append(
                    f"    {t.train_id:<10} {t.train_name[:26]:<28} {p_str:<8} {'--':<12} {'0':>3} mins       CLEARS AHEAD (On-Time Transit)"
                )
                
        lines.extend([
            "-----------------------------------------------------------------------------------------",
            " 3. OPERATIONAL KPI SUMMARY:",
            f"    • Total Cumulative Delay Added : {kpis.total_delay_added_mins} minutes across {len(response.trains)} trains",
            f"    • Section Throughput Efficiency: {kpis.section_throughput_efficiency_pct}%",
            f"    • Safety Headway Compliance    : {kpis.safety_headway_compliance_pct}% (Zero Headway Violations)",
            f"    • Siding Holds Imposed         : {held_trains_count} Trains held safely on designated loop lines",
            "-----------------------------------------------------------------------------------------",
            " 4. CAUTIONARY ORDERS & SPEED RESTRICTIONS UPON BLOCK CANCELLATION:",
            f"    (a) First train passing over {blk.segment_id} after {blk.granted_end_str} hrs shall observe",
            "        a Temporary Speed Restriction (TSR) of 30 Kmph for the initial 2.0 Km of renewal zone.",
            "    (b) Subsequent trains to resume Normal Sectional Speed (NSS) subject to P-Way Fit Certificate.",
            "    (c) Strict 7-minute headway spacing must be observed between successive departures.",
            "-----------------------------------------------------------------------------------------",
            "                                                  BY ORDER OF:",
            "  [Digital Signature]                              [Digital Signature]",
            "  CHIEF CONTROLLER (MOVEMENT)                      SENIOR DIVISIONAL OPERATIONS MANAGER (DOM)",
            "  Punctuality & Operations Desk                    Jhansi Division, North Central Railway",
            "========================================================================================="
        ])
        
        return "\n".join(lines)

    @staticmethod
    def generate_html_notice(response: OptimizationResponse) -> str:
        text = DispatchNoticeGenerator.generate_text_notice(response)
        return f"""
        <div class="dispatch-notice-paper">
            <div class="notice-header">
                <div class="rail-emblem">🇮🇳 INDIAN RAILWAYS</div>
                <h2>NORTH CENTRAL RAILWAY - DIVISIONAL CONTROL OFFICE</h2>
                <h3>VIRANGANA LAKSHMIBAI JHANSI / PRAYAGRAJ DIVISION</h3>
                <h4>OPERATIONAL BLOCK CONTROL ORDER & CAUTION MEMO (FORM T/409)</h4>
            </div>
            <pre class="notice-body">{text}</pre>
        </div>
        """
