"""
Test suite for Shop Preview Feature and related functionality
Tests:
- Shop preview endpoint (P1)
- Preview cost deduction (10 coins)
- Preview duration (2.5 minutes)
- Active previews tracking
- Sector shop functionality
- Activity logging (chores sector)
"""
import pytest
import requests
import os
import time
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://accountable-sectors.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "preview_test@example.com"
TEST_USER_PASSWORD = "test123"
TEST_USER_NAME = "PreviewTester"

# Create a unique test user for isolation
UNIQUE_USER_EMAIL = f"test_preview_{int(time.time())}@example.com"

class TestAuthAndSetup:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_register_user(self, session):
        """Register a new test user for preview testing"""
        response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": UNIQUE_USER_EMAIL,
            "password": "testpass123",
            "username": f"TestUser_{int(time.time())}"
        })
        # Can be 200 or 400 if user exists
        if response.status_code == 400:
            pytest.skip("User already exists, will use login")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"Registered user: {UNIQUE_USER_EMAIL}")
    
    def test_login_user(self, session):
        """Login with test user credentials"""
        # Try the provided test credentials first
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "user" in data
            print(f"Logged in as: {TEST_USER_EMAIL}")
        else:
            # Fallback - user might not exist, skip test
            print(f"Could not login with test credentials, status: {response.status_code}")


class TestShopEndpoints:
    """Tests for shop-related endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for testing"""
        # First try to register a new user
        unique_email = f"shop_test_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"ShopTester_{int(time.time())}"
        })
        if response.status_code == 200:
            return response.json()["token"], response.json()["user"]
        
        # Try existing test user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"], response.json()["user"]
        
        pytest.skip("Could not authenticate for shop tests")
    
    def test_get_main_shop_items(self, auth_token):
        """Test fetching main shop items"""
        token, user = auth_token
        response = requests.get(
            f"{BASE_URL}/api/shop/items/main",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0
        # Verify item structure
        for item in items:
            assert "id" in item
            assert "name" in item
            assert "cost" in item
            assert "coin_type" in item
        print(f"Main shop has {len(items)} items")
    
    def test_get_chores_shop_items(self, auth_token):
        """Test fetching chores sector shop items"""
        token, user = auth_token
        response = requests.get(
            f"{BASE_URL}/api/shop/items/chores",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0
        # Verify sector-specific items
        for item in items:
            assert item.get("sector") == "chores"
            assert item.get("coin_type") == "chores_coins"
        print(f"Chores shop has {len(items)} items")
    
    def test_get_all_sector_shop_items(self, auth_token):
        """Test fetching shop items for all sectors"""
        token, user = auth_token
        sectors = ["chores", "fitness", "learning", "mind", "faith", "cooking"]
        
        for sector in sectors:
            response = requests.get(
                f"{BASE_URL}/api/shop/items/{sector}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200, f"Failed for sector: {sector}"
            items = response.json()
            assert isinstance(items, list)
            print(f"{sector.capitalize()} shop has {len(items)} items")
    
    def test_invalid_sector_shop(self, auth_token):
        """Test that invalid sector returns 400"""
        token, user = auth_token
        response = requests.get(
            f"{BASE_URL}/api/shop/items/invalid_sector",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400


class TestShopPreviewFeature:
    """P1: Tests for the shop preview feature - 10 coins for 2.5 minutes"""
    
    @pytest.fixture(scope="class")
    def auth_with_coins(self):
        """Register a new user and earn coins through activities"""
        # Register a new user
        unique_email = f"preview_coins_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"PreviewCoins_{int(time.time())}"
        })
        if response.status_code != 200:
            pytest.skip("Could not register user for preview tests")
        
        token = response.json()["token"]
        user = response.json()["user"]
        
        # Earn some coins by logging activities (both main coins and sector coins)
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/activities",
                json={
                    "title": f"Test Activity {i}",
                    "description": "Earning coins for preview test",
                    "duration": 1800,  # 30 minutes = 30 XP, 15 coins
                    "sector": "chores"
                },
                headers={"Authorization": f"Bearer {token}"}
            )
        
        # Refresh user data
        profile_response = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        user = profile_response.json()
        
        return token, user
    
    def test_get_shop_items_for_preview(self, auth_with_coins):
        """Get shop items to use for preview testing"""
        token, user = auth_with_coins
        response = requests.get(
            f"{BASE_URL}/api/shop/items/chores",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        items = response.json()
        assert len(items) > 0
        print(f"Available items for preview: {[i['name'] for i in items]}")
        return items[0]  # Return first item for preview test
    
    def test_preview_costs_10_coins(self, auth_with_coins):
        """Test that preview deducts 10 coins"""
        token, user = auth_with_coins
        
        # Get shop items
        items_response = requests.get(
            f"{BASE_URL}/api/shop/items/chores",
            headers={"Authorization": f"Bearer {token}"}
        )
        items = items_response.json()
        assert len(items) > 0
        item = items[0]
        
        # Get current coins before preview
        profile_before = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        coins_before = profile_before.json().get("chores_coins", 0)
        print(f"Chores coins before preview: {coins_before}")
        
        # Skip if user doesn't have enough coins
        if coins_before < 10:
            pytest.skip(f"User has only {coins_before} chores_coins, need at least 10")
        
        # Start preview
        preview_response = requests.post(
            f"{BASE_URL}/api/shop/preview",
            json={"item_id": item["id"], "sector": "chores"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert preview_response.status_code == 200
        preview_data = preview_response.json()
        
        # Verify preview response structure
        assert preview_data.get("success") == True
        assert "expires_at" in preview_data
        assert "remaining_seconds" in preview_data
        
        # If it's a new preview, cost should be deducted
        if not preview_data.get("already_active"):
            assert preview_data.get("cost_deducted") == 10
            
            # Verify coins were deducted
            profile_after = requests.get(
                f"{BASE_URL}/api/user/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            coins_after = profile_after.json().get("chores_coins", 0)
            print(f"Chores coins after preview: {coins_after}")
            assert coins_after == coins_before - 10, f"Expected {coins_before - 10}, got {coins_after}"
        else:
            print("Preview was already active, no coins deducted")
        
        print(f"Preview expires at: {preview_data.get('expires_at')}")
        print(f"Remaining seconds: {preview_data.get('remaining_seconds')}")
    
    def test_preview_duration_150_seconds(self, auth_with_coins):
        """Test that preview lasts 2.5 minutes (150 seconds)"""
        token, user = auth_with_coins
        
        # Get shop items - use a different item
        items_response = requests.get(
            f"{BASE_URL}/api/shop/items/fitness",
            headers={"Authorization": f"Bearer {token}"}
        )
        items = items_response.json()
        if not items:
            pytest.skip("No fitness items available")
        
        # Need to earn some fitness coins first
        requests.post(
            f"{BASE_URL}/api/activities",
            json={
                "title": "Workout for preview test",
                "description": "Earning fitness coins",
                "duration": 1800,
                "sector": "fitness"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Check fitness coins
        profile = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        fitness_coins = profile.json().get("fitness_coins", 0)
        if fitness_coins < 10:
            pytest.skip(f"Not enough fitness coins: {fitness_coins}")
        
        item = items[0]
        
        # Start preview
        preview_response = requests.post(
            f"{BASE_URL}/api/shop/preview",
            json={"item_id": item["id"], "sector": "fitness"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert preview_response.status_code == 200
        preview_data = preview_response.json()
        
        # Verify duration
        remaining = preview_data.get("remaining_seconds", 0)
        # Should be approximately 150 seconds (allow some tolerance)
        assert 145 <= remaining <= 150, f"Expected ~150 seconds, got {remaining}"
        print(f"Preview duration: {remaining} seconds")
    
    def test_get_active_previews(self, auth_with_coins):
        """Test fetching active previews"""
        token, user = auth_with_coins
        
        response = requests.get(
            f"{BASE_URL}/api/shop/previews",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "previews" in data
        assert isinstance(data["previews"], list)
        
        for preview in data["previews"]:
            assert "item" in preview
            assert "expires_at" in preview
            assert "remaining_seconds" in preview
            print(f"Active preview: {preview['item']['name']} - {preview['remaining_seconds']}s remaining")
    
    def test_preview_already_active_no_deduction(self, auth_with_coins):
        """Test that re-previewing an active item doesn't deduct more coins"""
        token, user = auth_with_coins
        
        # Get active previews
        previews_response = requests.get(
            f"{BASE_URL}/api/shop/previews",
            headers={"Authorization": f"Bearer {token}"}
        )
        active_previews = previews_response.json().get("previews", [])
        
        if not active_previews:
            pytest.skip("No active previews to test re-preview")
        
        active_item = active_previews[0]["item"]
        sector = active_item.get("sector", "main")
        
        # Get current coins
        profile_before = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        coin_field = f"{sector}_coins" if sector != "main" else "coins"
        coins_before = profile_before.json().get(coin_field, 0)
        
        # Try to preview again
        preview_response = requests.post(
            f"{BASE_URL}/api/shop/preview",
            json={"item_id": active_item["id"], "sector": sector},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert preview_response.status_code == 200
        preview_data = preview_response.json()
        
        # Should indicate already active
        assert preview_data.get("already_active") == True, "Should indicate preview is already active"
        
        # Coins should not be deducted
        profile_after = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        coins_after = profile_after.json().get(coin_field, 0)
        assert coins_after == coins_before, "No coins should be deducted for already active preview"
        print(f"Re-preview check passed: coins unchanged at {coins_after}")
    
    def test_preview_insufficient_coins(self, auth_with_coins):
        """Test that preview fails with insufficient coins"""
        # Register a new user with no coins
        unique_email = f"no_coins_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"NoCoinUser_{int(time.time())}"
        })
        if response.status_code != 200:
            pytest.skip("Could not register new user")
        
        token = response.json()["token"]
        
        # Get shop items
        items_response = requests.get(
            f"{BASE_URL}/api/shop/items/main",
            headers={"Authorization": f"Bearer {token}"}
        )
        items = items_response.json()
        
        # Try to preview - should fail
        preview_response = requests.post(
            f"{BASE_URL}/api/shop/preview",
            json={"item_id": items[0]["id"], "sector": "main"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert preview_response.status_code == 400
        error_data = preview_response.json()
        assert "insufficient" in error_data.get("detail", "").lower()
        print(f"Insufficient coins error: {error_data.get('detail')}")


class TestChoresSectorActivities:
    """Tests for chore logging and XP/coin earning"""
    
    @pytest.fixture(scope="class")
    def chores_user(self):
        """Register user for chores testing"""
        unique_email = f"chores_test_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"ChoresTester_{int(time.time())}"
        })
        if response.status_code != 200:
            pytest.skip("Could not register user for chores tests")
        
        return response.json()["token"], response.json()["user"]
    
    def test_log_chore_activity(self, chores_user):
        """Test logging a chore activity earns XP and coins"""
        token, user = chores_user
        
        # Log a chore
        response = requests.post(
            f"{BASE_URL}/api/activities",
            json={
                "title": "Cleaned the kitchen",
                "description": "Deep cleaned all surfaces",
                "duration": 1800,  # 30 minutes
                "sector": "chores"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        activity = response.json()
        
        # Verify activity data
        assert activity.get("title") == "Cleaned the kitchen"
        assert activity.get("sector") == "chores"
        assert activity.get("xp_earned") > 0
        assert activity.get("coins_earned") > 0
        assert activity.get("sector_xp_earned") > 0
        assert activity.get("sector_coins_earned") > 0
        
        # XP should be ~30 (duration/60)
        assert activity.get("xp_earned") == 30
        # Coins should be ~15 (xp/2)
        assert activity.get("coins_earned") == 15
        
        print(f"Chore completed: +{activity.get('xp_earned')} XP, +{activity.get('coins_earned')} coins")
    
    def test_chore_updates_user_stats(self, chores_user):
        """Test that logging chore updates user's chores_xp and chores_coins"""
        token, user = chores_user
        
        # Get profile before
        profile_before = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        before = profile_before.json()
        
        # Log a chore
        response = requests.post(
            f"{BASE_URL}/api/activities",
            json={
                "title": "Vacuumed living room",
                "description": "",
                "duration": 1200,  # 20 minutes = 20 XP, 10 coins
                "sector": "chores"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        activity = response.json()
        
        # Get profile after
        profile_after = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        after = profile_after.json()
        
        # Verify XP increased
        assert after["chores_xp"] == before["chores_xp"] + activity["xp_earned"]
        assert after["chores_coins"] == before["chores_coins"] + activity["coins_earned"]
        assert after["accountable_xp"] == before["accountable_xp"] + activity["xp_earned"]
        
        print(f"User stats updated: chores_xp {before['chores_xp']} -> {after['chores_xp']}")
    
    def test_get_chore_activities(self, chores_user):
        """Test fetching user's chore activities"""
        token, user = chores_user
        
        response = requests.get(
            f"{BASE_URL}/api/activities/chores",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)
        assert len(activities) > 0  # Should have activities from previous tests
        
        for activity in activities:
            assert activity.get("sector") == "chores"
            assert "title" in activity
            assert "xp_earned" in activity
        
        print(f"Retrieved {len(activities)} chore activities")
    
    def test_invalid_sector_activity(self, chores_user):
        """Test that invalid sector returns 400"""
        token, user = chores_user
        
        response = requests.post(
            f"{BASE_URL}/api/activities",
            json={
                "title": "Invalid sector test",
                "description": "",
                "duration": 600,
                "sector": "invalid_sector"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400


class TestMainShopPreview:
    """Tests for main shop preview using main coins"""
    
    @pytest.fixture(scope="class")
    def main_shop_user(self):
        """Register user with main coins"""
        unique_email = f"main_shop_{int(time.time())}@example.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "username": f"MainShopTester_{int(time.time())}"
        })
        if response.status_code != 200:
            pytest.skip("Could not register user for main shop tests")
        
        token = response.json()["token"]
        
        # Earn some main coins by logging activities
        for i in range(5):
            requests.post(
                f"{BASE_URL}/api/activities",
                json={
                    "title": f"Activity {i}",
                    "description": "Earning coins",
                    "duration": 1800,
                    "sector": "chores"
                },
                headers={"Authorization": f"Bearer {token}"}
            )
        
        # Get updated profile
        profile = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        return token, profile.json()
    
    def test_main_shop_preview_uses_main_coins(self, main_shop_user):
        """Test that main shop preview uses main coins (not sector coins)"""
        token, user = main_shop_user
        
        # Get main shop items
        items_response = requests.get(
            f"{BASE_URL}/api/shop/items/main",
            headers={"Authorization": f"Bearer {token}"}
        )
        items = items_response.json()
        assert len(items) > 0
        
        # Get current main coins
        profile_before = requests.get(
            f"{BASE_URL}/api/user/profile",
            headers={"Authorization": f"Bearer {token}"}
        )
        main_coins_before = profile_before.json().get("coins", 0)
        print(f"Main coins before: {main_coins_before}")
        
        if main_coins_before < 10:
            pytest.skip(f"Not enough main coins: {main_coins_before}")
        
        item = items[0]
        
        # Preview item with sector=main or no sector
        preview_response = requests.post(
            f"{BASE_URL}/api/shop/preview",
            json={"item_id": item["id"], "sector": "main"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert preview_response.status_code == 200
        preview_data = preview_response.json()
        
        if not preview_data.get("already_active"):
            # Verify main coins were deducted
            profile_after = requests.get(
                f"{BASE_URL}/api/user/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            main_coins_after = profile_after.json().get("coins", 0)
            assert main_coins_after == main_coins_before - 10
            print(f"Main coins after: {main_coins_after} (deducted 10)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
