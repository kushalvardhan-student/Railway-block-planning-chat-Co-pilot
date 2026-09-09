import json
from backend.models import TrackNetwork
from backend.nlp_copilot import RailwayNLPCopilot

def test_nlp_parser():
    with open("data/track_network.json", "r") as f:
        net_dict = json.load(f)
    network = TrackNetwork(**net_dict)
    copilot = RailwayNLPCopilot(network)

    # Test Query 1: Executive query from specification
    q1 = "Grant a 180-minute track maintenance block on Kanpur-Jhansi segment starting at 14:00"
    p1 = copilot.parse_user_command(q1)
    print("Test 1 parsed:", p1.model_dump())
    assert p1.duration_mins == 180
    assert p1.start_time == "14:00"
    assert p1.department == "Track Engineering"
    assert p1.action_type == "GRANT_BLOCK"

    # Test Query 2: OHE block
    q2 = "OHE wire inspection on Orai to Ait for 2 hours at 11:30 am"
    p2 = copilot.parse_user_command(q2)
    print("Test 2 parsed:", p2.model_dump())
    assert p2.duration_mins == 120
    assert p2.start_time == "11:30"
    assert p2.department == "Traction / OHE"
    assert p2.segment_id == "ORAI-AIT"

    # Test Query 3: Postpone block
    q3 = "Postpone block on KPI-ORAI by 30 mins to 14:30"
    p3 = copilot.parse_user_command(q3)
    print("Test 3 parsed:", p3.model_dump())
    assert p3.action_type == "POSTPONE_BLOCK"
    assert p3.start_time == "14:30"

    print("--- ALL NLP PARSER TESTS PASSED! ---")

if __name__ == "__main__":
    test_nlp_parser()
