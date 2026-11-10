from app.services.order_extractor import order_extractor


def test_telugu_dominant_workshop_example():
    transcript = "Ravi garu bike repair kosam icharu. Brake pads change cheyyali. Repu evening delivery."
    info = order_extractor.extract(transcript, language_code="te-IN")

    assert info.intent == "create_work_order"
    assert info.customer_name == "Ravi"
    assert info.vehicle_or_asset == "Bike"
    assert "Brake pad" in info.service_type
    assert info.delivery_date == "Tomorrow"
    assert info.delivery_time == "evening"
    assert info.requires_confirmation is True


def test_missing_customer_name_remains_none():
    transcript = "Bike oil change cheyyali. Repu podduna delivery."
    info = order_extractor.extract(transcript, language_code="te-IN")

    assert info.customer_name is None
    assert info.vehicle_or_asset == "Bike"
    assert "Oil change" in info.service_type
    assert info.delivery_date == "Tomorrow"


def test_cost_extraction():
    transcript = "Kiran garu activa service. Total 1500 rupees cost estimate. Today evening delivery."
    info = order_extractor.extract(transcript, language_code="te-IN")

    assert info.customer_name == "Kiran"
    assert info.vehicle_or_asset == "Bike"
    assert info.estimated_cost == 1500.0
    assert info.delivery_date == "Today"
    assert info.delivery_time == "evening"


def test_electrician_service_extraction():
    transcript = "Suresh garu switchboard repair and fan wiring issue. Repu delivery."
    info = order_extractor.extract(transcript, language_code="te-IN")

    assert info.customer_name == "Suresh"
    assert info.vehicle_or_asset in {"Fan", "Switchboard"}
    assert "wiring" in info.service_type.lower() or "electrical" in info.service_type.lower()
    assert info.delivery_date == "Tomorrow"


def test_empty_transcript_handling():
    info = order_extractor.extract("", language_code="te-IN")
    assert info.customer_name is None
    assert info.vehicle_or_asset is None
    assert info.requires_confirmation is True

