def test_create_work_order_success(client):
    payload = {
        "customer_name": "Ravi",
        "service_type": "Brake pad replacement",
        "vehicle_or_asset": "Bike",
        "description": "Replace worn out front brake pads",
        "delivery_date": "Tomorrow",
        "delivery_time": "evening",
        "estimated_cost": 850.0,
        "status": "pending",
        "original_transcript": "Ravi garu bike repair kosam icharu. Brake pads change cheyyali.",
        "language_code": "te-IN",
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["customer_name"] == "Ravi"
    assert data["order_number"].startswith("VO-")
    assert data["status"] == "pending"
    assert data["id"] > 0


def test_create_work_order_missing_customer_name(client):
    payload = {
        "customer_name": "",
        "service_type": "Oil change",
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422


def test_create_work_order_missing_service_type(client):
    payload = {
        "customer_name": "Ravi",
        "service_type": "",
    }
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 422


def test_unique_order_numbers(client):
    res1 = client.post(
        "/api/orders",
        json={"customer_name": "Client A", "service_type": "Service A"},
    )
    res2 = client.post(
        "/api/orders",
        json={"customer_name": "Client B", "service_type": "Service B"},
    )
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res1.json()["order_number"] != res2.json()["order_number"]


def test_list_and_filter_orders(client):
    client.post(
        "/api/orders",
        json={"customer_name": "Venkatesh", "service_type": "Wiring", "status": "pending"},
    )
    client.post(
        "/api/orders",
        json={"customer_name": "Anil", "service_type": "Tap repair", "status": "completed"},
    )

    # Filter by status
    res = client.get("/api/orders?status=completed")
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 1
    assert all(o["status"] == "completed" for o in orders)

    # Search by customer name
    search_res = client.get("/api/orders?q=Venkatesh")
    assert search_res.status_code == 200
    assert any(o["customer_name"] == "Venkatesh" for o in search_res.json())


def test_update_order_status(client):
    create_res = client.post(
        "/api/orders",
        json={"customer_name": "Ramesh", "service_type": "General Checkup", "status": "pending"},
    )
    order_id = create_res.json()["id"]

    patch_res = client.patch(f"/api/orders/{order_id}", json={"status": "in_progress"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_progress"

    # Invalid status
    invalid_patch = client.patch(f"/api/orders/{order_id}", json={"status": "unknown_state"})
    assert invalid_patch.status_code == 422


def test_get_non_existent_order(client):
    res = client.get("/api/orders/999999")
    assert res.status_code == 404


def test_stats_endpoint(client):
    res = client.get("/api/stats")
    assert res.status_code == 200
    stats = res.json()
    assert "total_orders" in stats
    assert "pending_orders" in stats
    assert "completed_orders" in stats
    assert isinstance(stats["recent_orders"], list)

