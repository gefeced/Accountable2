from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ['DB_NAME']]

SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

SECTORS = ['chores', 'fitness', 'learning', 'mind', 'faith', 'cooking']

DEFAULT_CHORE_TEMPLATES = [
    "Laundry",
    "Vacuum",
    "Trash",
    "Wipe counters",
    "Clean bathroom",
    "Make bed",
    "Tidy room",
    "Mop floors",
    "Change lights",
    "Cook",
    "Take dishes out",
    "Load dishes",
]

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    username: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    accountable_xp: int = 0
    accountable_level: int = 1
    coins: int = 0
    streak: int = 0
    last_active: str
    group_id: Optional[str] = None
    theme: str = "playful"
    profile_picture: Optional[str] = None
    
    chores_xp: int = 0
    chores_level: int = 1
    chores_coins: int = 0
    
    fitness_xp: int = 0
    fitness_level: int = 1
    fitness_coins: int = 0
    
    learning_xp: int = 0
    learning_level: int = 1
    learning_coins: int = 0
    
    mind_xp: int = 0
    mind_level: int = 1
    mind_coins: int = 0
    
    faith_xp: int = 0
    faith_level: int = 1
    faith_coins: int = 0
    
    cooking_xp: int = 0
    cooking_level: int = 1
    cooking_coins: int = 0
    chores_streak: int = 0
    last_chores_date: Optional[str] = None
    
    achievements: List[str] = Field(default_factory=list)
    pets_owned: List[str] = Field(default_factory=list)
    music_player_owned: bool = False
    music_tracks_owned: List[str] = Field(default_factory=list)
    active_previews: Dict[str, str] = Field(default_factory=dict)  # item_id -> expiration ISO string
    chore_templates: List[str] = Field(default_factory=lambda: list(DEFAULT_CHORE_TEMPLATES))
    equipped_theme_item_id: Optional[str] = None
    equipped_pet_item_id: Optional[str] = None
    equipped_music_item_id: Optional[str] = None
    music_player_enabled: bool = False

class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    duration: int
    sector: str
    activity_meta: Optional[Dict[str, Any]] = None

class Activity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    sector: str
    title: str
    description: str
    xp_earned: int
    coins_earned: int
    sector_xp_earned: int
    sector_coins_earned: int
    duration: int
    completed_at: str
    activity_meta: Dict[str, Any] = Field(default_factory=dict)

class ShopItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    type: str
    sector: Optional[str] = None
    cost: int
    coin_type: str
    description: str
    image_url: Optional[str] = None

class PurchaseRequest(BaseModel):
    item_id: str
    sector: Optional[str] = None

class PreviewRequest(BaseModel):
    item_id: str
    sector: Optional[str] = None

class GroupCreate(BaseModel):
    name: str

class GroupJoin(BaseModel):
    code: str

class Group(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    code: str
    created_by: str
    members: List[str]
    created_at: str

class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    username: str
    xp: int
    level: int

class Achievement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: str
    icon: str
    requirement: Dict[str, Any]


class ThemeUpdate(BaseModel):
    theme: str


class ProfilePictureUpdate(BaseModel):
    profile_picture: Optional[str] = None


class ChoreTemplatesUpdate(BaseModel):
    templates: List[str]


class InventoryEquipRequest(BaseModel):
    item_id: str
    equipped: bool = True

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_level(xp: int) -> int:
    return max(1, int((xp / 100) ** 0.5) + 1)

def calculate_xp_for_duration(duration_seconds: int) -> int:
    return max(10, duration_seconds // 60)


def normalize_chore_templates(templates: List[str]) -> List[str]:
    normalized = []
    seen = set()
    for template in templates:
        cleaned = template.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned[:60])
    return normalized[:30]

async def check_achievements(user: User) -> List[str]:
    new_achievements = []
    
    achievements_def = [
        {"id": "first_activity", "name": "First Steps", "check": lambda u: u.accountable_xp > 0},
        {"id": "level_5", "name": "Rising Star", "check": lambda u: u.accountable_level >= 5},
        {"id": "level_10", "name": "Dedicated", "check": lambda u: u.accountable_level >= 10},
        {"id": "streak_7", "name": "Week Warrior", "check": lambda u: u.streak >= 7},
        {"id": "streak_30", "name": "Month Master", "check": lambda u: u.streak >= 30},
        {"id": "all_sectors", "name": "Renaissance", "check": lambda u: all([getattr(u, f"{s}_xp") > 0 for s in SECTORS])},
        {"id": "rich", "name": "Wealthy", "check": lambda u: u.coins >= 1000},
        {"id": "first_pet", "name": "Pet Owner", "check": lambda u: len(u.pets_owned) > 0},
        {"id": "music_lover", "name": "Music Lover", "check": lambda u: u.music_player_owned},
    ]
    
    for ach in achievements_def:
        if ach["id"] not in user.achievements and ach["check"](user):
            new_achievements.append(ach["id"])
    
    return new_achievements

# Auth routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "username": user_data.username,
        "password": hash_password(user_data.password),
        "accountable_xp": 0,
        "accountable_level": 1,
        "coins": 0,
        "streak": 0,
        "last_active": datetime.now(timezone.utc).isoformat(),
        "group_id": None,
        "theme": "playful",
        "chores_xp": 0, "chores_level": 1, "chores_coins": 0,
        "fitness_xp": 0, "fitness_level": 1, "fitness_coins": 0,
        "learning_xp": 0, "learning_level": 1, "learning_coins": 0,
        "mind_xp": 0, "mind_level": 1, "mind_coins": 0,
        "faith_xp": 0, "faith_level": 1, "faith_coins": 0,
        "cooking_xp": 0, "cooking_level": 1, "cooking_coins": 0,
        "achievements": [],
        "pets_owned": [],
        "music_player_owned": False,
        "music_tracks_owned": [],
        "active_previews": {},
        "chore_templates": list(DEFAULT_CHORE_TEMPLATES),
        "profile_picture": None,
        "chores_streak": 0,
        "last_chores_date": None,
        "equipped_theme_item_id": None,
        "equipped_pet_item_id": None,
        "equipped_music_item_id": None,
        "music_player_enabled": False,
    }
    
    await db.users.insert_one(user_doc)
    token = create_access_token({"sub": user_id})
    
    user_response = {k: v for k, v in user_doc.items() if k not in ["password", "_id"]}
    return {"token": token, "user": user_response}

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    user_response = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": user_response}

# User routes
@api_router.get("/user/profile", response_model=User)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.patch("/user/theme")
async def update_theme(theme: ThemeUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one({"id": current_user.id}, {"$set": {"theme": theme.theme}})
    return {"success": True}


@api_router.patch("/user/profile-picture")
async def update_profile_picture(
    payload: ProfilePictureUpdate,
    current_user: User = Depends(get_current_user),
):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"profile_picture": payload.profile_picture}},
    )
    return {"success": True, "profile_picture": payload.profile_picture}


@api_router.get("/chores/templates")
async def get_chore_templates(current_user: User = Depends(get_current_user)):
    templates = normalize_chore_templates(current_user.chore_templates or DEFAULT_CHORE_TEMPLATES)
    if templates != current_user.chore_templates:
        await db.users.update_one({"id": current_user.id}, {"$set": {"chore_templates": templates}})
    return {"templates": templates}


@api_router.patch("/chores/templates")
async def update_chore_templates(
    payload: ChoreTemplatesUpdate,
    current_user: User = Depends(get_current_user),
):
    templates = normalize_chore_templates(payload.templates)
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"chore_templates": templates}},
    )
    return {"success": True, "templates": templates}

# Generic Activity routes
@api_router.post("/activities", response_model=Activity)
async def create_activity(activity_data: ActivityCreate, current_user: User = Depends(get_current_user)):
    if activity_data.sector not in SECTORS:
        raise HTTPException(status_code=400, detail="Invalid sector")
    
    activity_meta = activity_data.activity_meta or {}
    xp_earned = calculate_xp_for_duration(activity_data.duration)
    coins_earned = xp_earned // 2
    chores_streak = current_user.chores_streak
    last_chores_date = current_user.last_chores_date

    if activity_data.sector == "chores":
        completed_chores = activity_meta.get("completed_chores") or []
        completed_chores = [chore.strip() for chore in completed_chores if chore and chore.strip()]
        chore_xp = len(completed_chores) * 10
        today_iso = datetime.now(timezone.utc).date().isoformat()
        daily_bonus = 20 if last_chores_date != today_iso else 0
        xp_earned = xp_earned + chore_xp + daily_bonus
        coins_earned = xp_earned
        activity_meta = {
            **activity_meta,
            "completed_chores": completed_chores,
            "time_xp": calculate_xp_for_duration(activity_data.duration),
            "chore_xp": chore_xp,
            "daily_bonus_xp": daily_bonus,
            "base_xp": xp_earned,
            "multipliers": activity_meta.get("multipliers") or [],
        }
    
    activity_id = str(uuid.uuid4())
    activity_doc = {
        "id": activity_id,
        "user_id": current_user.id,
        "sector": activity_data.sector,
        "title": activity_data.title,
        "description": activity_data.description,
        "xp_earned": xp_earned,
        "coins_earned": coins_earned,
        "sector_xp_earned": xp_earned,
        "sector_coins_earned": coins_earned,
        "duration": activity_data.duration,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "activity_meta": activity_meta,
    }
    
    await db.activities.insert_one(activity_doc)
    
    sector_xp_field = f"{activity_data.sector}_xp"
    sector_coins_field = f"{activity_data.sector}_coins"
    sector_level_field = f"{activity_data.sector}_level"
    
    new_accountable_xp = current_user.accountable_xp + xp_earned
    new_coins = current_user.coins + coins_earned
    new_accountable_level = calculate_level(new_accountable_xp)
    
    new_sector_xp = getattr(current_user, sector_xp_field) + xp_earned
    new_sector_coins = getattr(current_user, sector_coins_field) + coins_earned
    new_sector_level = calculate_level(new_sector_xp)
    
    today = datetime.now(timezone.utc).date()
    last_active_date = datetime.fromisoformat(current_user.last_active).date()
    
    if (today - last_active_date).days == 1:
        new_streak = current_user.streak + 1
    elif today == last_active_date:
        new_streak = current_user.streak
    else:
        new_streak = 1
    
    update_doc = {
        "accountable_xp": new_accountable_xp,
        "accountable_level": new_accountable_level,
        "coins": new_coins,
        sector_xp_field: new_sector_xp,
        sector_coins_field: new_sector_coins,
        sector_level_field: new_sector_level,
        "streak": new_streak,
        "last_active": datetime.now(timezone.utc).isoformat()
    }

    if activity_data.sector == "chores":
        today = datetime.now(timezone.utc).date()
        last_chores = datetime.fromisoformat(last_chores_date).date() if last_chores_date else None
        if last_chores == today:
            chores_streak = current_user.chores_streak
        elif last_chores and (today - last_chores).days == 1:
            chores_streak = current_user.chores_streak + 1
        else:
            chores_streak = 1
        update_doc["chores_streak"] = chores_streak
        update_doc["last_chores_date"] = today.isoformat()
    
    await db.users.update_one({"id": current_user.id}, {"$set": update_doc})
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password": 0})
    new_achievements = await check_achievements(User(**updated_user))
    
    if new_achievements:
        await db.users.update_one(
            {"id": current_user.id},
            {"$push": {"achievements": {"$each": new_achievements}}}
        )
    
    return Activity(**activity_doc)

@api_router.get("/activities/{sector}", response_model=List[Activity])
async def get_activities(sector: str, current_user: User = Depends(get_current_user)):
    if sector not in SECTORS:
        raise HTTPException(status_code=400, detail="Invalid sector")
    activities = await db.activities.find(
        {"user_id": current_user.id, "sector": sector},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(100)
    return activities

# Shop routes
DEPRECATED_SHOP_ITEM_NAMES = ["Dumbbell Pet", "Zen Stone Pet"]


async def purge_deprecated_shop_items():
    deprecated_items = await db.shop_items.find(
        {"name": {"$in": DEPRECATED_SHOP_ITEM_NAMES}},
        {"_id": 0, "id": 1},
    ).to_list(20)

    if not deprecated_items:
        return

    deprecated_ids = [item["id"] for item in deprecated_items]
    await db.shop_items.delete_many({"id": {"$in": deprecated_ids}})
    await db.users.update_many(
        {},
        {
            "$pull": {
                "pets_owned": {"$in": deprecated_ids},
                "user_inventory": {"$in": deprecated_ids},
            }
        },
    )
    await db.users.update_many(
        {"equipped_pet_item_id": {"$in": deprecated_ids}},
        {"$set": {"equipped_pet_item_id": None}},
    )


async def get_shop_items_for_sector(sector: str):
    if sector not in SECTORS and sector != "main":
        raise HTTPException(status_code=400, detail="Invalid sector")

    await purge_deprecated_shop_items()
    
    items = await db.shop_items.find({"sector": sector}, {"_id": 0}).to_list(100)
    
    if not items:
        default_items = []
        if sector == "chores":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Mop Pet", "type": "pet", "sector": "chores", "cost": 500, "coin_type": "chores_coins", "description": "A helpful mop that cleans up and gives XP bonuses"},
                {"id": str(uuid.uuid4()), "name": "Double XP Boost", "type": "powerup", "sector": "chores", "cost": 50, "coin_type": "chores_coins", "description": "2x XP for your next chore"},
                {"id": str(uuid.uuid4()), "name": "Clean Theme", "type": "theme", "sector": "chores", "cost": 150, "coin_type": "chores_coins", "description": "Spotless theme for chores"},
            ]
        elif sector == "fitness":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Power Theme", "type": "theme", "sector": "fitness", "cost": 180, "coin_type": "fitness_coins", "description": "A bold red theme for workout days"},
                {"id": str(uuid.uuid4()), "name": "Stamina Boost", "type": "powerup", "sector": "fitness", "cost": 50, "coin_type": "fitness_coins", "description": "2x XP for your next workout"},
            ]
        elif sector == "learning":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Book Pet", "type": "pet", "sector": "learning", "cost": 500, "coin_type": "learning_coins", "description": "Wise companion for learning"},
                {"id": str(uuid.uuid4()), "name": "Focus Theme", "type": "theme", "sector": "learning", "cost": 180, "coin_type": "learning_coins", "description": "A bright orange theme for study sessions"},
                {"id": str(uuid.uuid4()), "name": "Focus Boost", "type": "powerup", "sector": "learning", "cost": 50, "coin_type": "learning_coins", "description": "2x XP for your next study session"},
            ]
        elif sector == "mind":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Calm Theme", "type": "theme", "sector": "mind", "cost": 180, "coin_type": "mind_coins", "description": "A grounded green theme for mind sessions"},
                {"id": str(uuid.uuid4()), "name": "Clarity Boost", "type": "powerup", "sector": "mind", "cost": 50, "coin_type": "mind_coins", "description": "2x XP for your next mindfulness activity"},
            ]
        elif sector == "faith":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Dove Pet", "type": "pet", "sector": "faith", "cost": 500, "coin_type": "faith_coins", "description": "Spiritual companion"},
                {"id": str(uuid.uuid4()), "name": "Grace Boost", "type": "powerup", "sector": "faith", "cost": 50, "coin_type": "faith_coins", "description": "2x XP for your next faith activity"},
            ]
        elif sector == "cooking":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Chef Hat Pet", "type": "pet", "sector": "cooking", "cost": 500, "coin_type": "cooking_coins", "description": "Culinary companion"},
                {"id": str(uuid.uuid4()), "name": "Taste Boost", "type": "powerup", "sector": "cooking", "cost": 50, "coin_type": "cooking_coins", "description": "2x XP for your next cooking session"},
            ]
        elif sector == "main":
            default_items = [
                {"id": str(uuid.uuid4()), "name": "Music Player", "type": "tool", "sector": "main", "cost": 1000, "coin_type": "coins", "description": "A compact player you can keep in the corner while you work"},
                {"id": str(uuid.uuid4()), "name": "Gold Trophy", "type": "trophy", "sector": "main", "cost": 500, "coin_type": "coins", "description": "Show off your achievements"},
                {"id": str(uuid.uuid4()), "name": "Chill Beats", "type": "music", "sector": "main", "cost": 100, "coin_type": "coins", "description": "Relaxing background music"},
                {"id": str(uuid.uuid4()), "name": "Focus Flow", "type": "music", "sector": "main", "cost": 120, "coin_type": "coins", "description": "Steady electronic focus loops"},
                {"id": str(uuid.uuid4()), "name": "Motivational Rise", "type": "music", "sector": "main", "cost": 140, "coin_type": "coins", "description": "Upbeat momentum for finishing strong"},
            ]
        
        if default_items:
            await db.shop_items.insert_many(default_items)
            items = default_items
    else:
        existing_names = {item["name"] for item in items}
        missing_items = []

        if sector == "main":
            missing_items = [
                {"id": str(uuid.uuid4()), "name": "Focus Flow", "type": "music", "sector": "main", "cost": 120, "coin_type": "coins", "description": "Steady electronic focus loops"},
                {"id": str(uuid.uuid4()), "name": "Motivational Rise", "type": "music", "sector": "main", "cost": 140, "coin_type": "coins", "description": "Upbeat momentum for finishing strong"},
            ]
        elif sector == "fitness":
            missing_items = [
                {"id": str(uuid.uuid4()), "name": "Power Theme", "type": "theme", "sector": "fitness", "cost": 180, "coin_type": "fitness_coins", "description": "A bold red theme for workout days"},
            ]
        elif sector == "learning":
            missing_items = [
                {"id": str(uuid.uuid4()), "name": "Focus Theme", "type": "theme", "sector": "learning", "cost": 180, "coin_type": "learning_coins", "description": "A bright orange theme for study sessions"},
            ]
        elif sector == "mind":
            missing_items = [
                {"id": str(uuid.uuid4()), "name": "Calm Theme", "type": "theme", "sector": "mind", "cost": 180, "coin_type": "mind_coins", "description": "A grounded green theme for mind sessions"},
            ]

        to_insert = [item for item in missing_items if item["name"] not in existing_names]
        if to_insert:
            await db.shop_items.insert_many(to_insert)
            items.extend(to_insert)
    
    return items


@api_router.get("/shop/items/all")
async def get_all_shop_items():
    sectors = ["main", *SECTORS]
    items = []
    for sector in sectors:
        sector_items = await get_shop_items_for_sector(sector)
        items.extend(sector_items)
    return {"items": items}


@api_router.get("/shop/items/{sector}", response_model=List[ShopItem])
async def get_shop_items(sector: str):
    return await get_shop_items_for_sector(sector)

@api_router.post("/shop/purchase")
async def purchase_item(purchase: PurchaseRequest, current_user: User = Depends(get_current_user)):
    item = await db.shop_items.find_one({"id": purchase.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing_inventory = await db.user_inventory.find_one(
        {"user_id": current_user.id, "item_id": purchase.item_id},
        {"_id": 0}
    )
    if existing_inventory:
        raise HTTPException(status_code=400, detail="You already own this item")
    
    coin_field = "coins"
    user_coins = current_user.coins
    
    if user_coins < item["cost"]:
        raise HTTPException(status_code=400, detail="Insufficient coins")

    update_doc = {coin_field: user_coins - item["cost"]}
    
    if item["type"] == "pet":
        update_doc["equipped_pet_item_id"] = purchase.item_id
        await db.users.update_one(
            {"id": current_user.id},
            {"$push": {"pets_owned": purchase.item_id}, "$set": update_doc}
        )
    elif item["type"] == "tool" and item["name"] == "Music Player":
        update_doc["music_player_owned"] = True
        update_doc["music_player_enabled"] = True
        await db.users.update_one({"id": current_user.id}, {"$set": update_doc})
    elif item["type"] == "music":
        update_doc["equipped_music_item_id"] = purchase.item_id
        await db.users.update_one(
            {"id": current_user.id},
            {"$push": {"music_tracks_owned": purchase.item_id}, "$set": update_doc}
        )
    elif item["type"] == "theme":
        update_doc["equipped_theme_item_id"] = purchase.item_id
        await db.users.update_one({"id": current_user.id}, {"$set": update_doc})
    else:
        await db.users.update_one({"id": current_user.id}, {"$set": update_doc})
    
    inventory_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "item_id": purchase.item_id,
        "purchased_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_inventory.insert_one(inventory_doc)
    
    # Check for new achievements after purchase
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0, "password": 0})
    new_achievements = await check_achievements(User(**updated_user))
    
    if new_achievements:
        await db.users.update_one(
            {"id": current_user.id},
            {"$push": {"achievements": {"$each": new_achievements}}}
        )
    
    return {"success": True, "item": item, "new_achievements": new_achievements}


@api_router.get("/inventory")
async def get_inventory(current_user: User = Depends(get_current_user)):
    inventory_rows = await db.user_inventory.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("purchased_at", -1).to_list(500)

    seen_item_ids = []
    for row in inventory_rows:
        item_id = row["item_id"]
        if item_id not in seen_item_ids:
            seen_item_ids.append(item_id)

    items = []
    for item_id in seen_item_ids:
        item = await db.shop_items.find_one({"id": item_id}, {"_id": 0})
        if not item:
            continue

        equipped = False
        if item["type"] == "theme":
            equipped = current_user.equipped_theme_item_id == item_id
        elif item["type"] == "pet":
            equipped = current_user.equipped_pet_item_id == item_id
        elif item["type"] == "music":
            equipped = current_user.equipped_music_item_id == item_id
        elif item["type"] == "tool" and item["name"] == "Music Player":
            equipped = current_user.music_player_enabled

        items.append({
            **item,
            "equipped": equipped,
        })

    return {"items": items}


@api_router.post("/inventory/equip")
async def equip_inventory_item(
    payload: InventoryEquipRequest,
    current_user: User = Depends(get_current_user),
):
    item = await db.shop_items.find_one({"id": payload.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_doc = {}

    if item["type"] == "theme":
        inventory = await db.user_inventory.find_one({"user_id": current_user.id, "item_id": payload.item_id}, {"_id": 0})
        if not inventory:
            raise HTTPException(status_code=400, detail="You do not own this theme")
        update_doc["equipped_theme_item_id"] = payload.item_id if payload.equipped else None
    elif item["type"] == "pet":
        if payload.item_id not in current_user.pets_owned:
            raise HTTPException(status_code=400, detail="You do not own this pet")
        update_doc["equipped_pet_item_id"] = payload.item_id if payload.equipped else None
    elif item["type"] == "music":
        if payload.item_id not in current_user.music_tracks_owned:
            raise HTTPException(status_code=400, detail="You do not own this track")
        update_doc["equipped_music_item_id"] = payload.item_id if payload.equipped else None
    elif item["type"] == "tool" and item["name"] == "Music Player":
        if not current_user.music_player_owned:
            raise HTTPException(status_code=400, detail="You do not own the Music Player")
        update_doc["music_player_enabled"] = payload.equipped
    else:
        raise HTTPException(status_code=400, detail="This item cannot be equipped")

    await db.users.update_one({"id": current_user.id}, {"$set": update_doc})
    return {"success": True}

PREVIEW_COST = 10  # Coins
PREVIEW_DURATION_SECONDS = 150  # 2.5 minutes

@api_router.post("/shop/preview")
async def preview_item(preview: PreviewRequest, current_user: User = Depends(get_current_user)):
    """Start a preview of a shop item for 2.5 minutes, costs 10 coins"""
    item = await db.shop_items.find_one({"id": preview.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    existing_inventory = await db.user_inventory.find_one(
        {"user_id": current_user.id, "item_id": preview.item_id},
        {"_id": 0}
    )
    if existing_inventory:
        raise HTTPException(status_code=400, detail="You already own this item")

    if item["type"] == "powerup":
        raise HTTPException(status_code=400, detail="Powerups cannot be previewed")
    
    coin_field = "coins"
    user_coins = current_user.coins
    
    if user_coins < PREVIEW_COST:
        raise HTTPException(status_code=400, detail=f"Insufficient coins. Preview costs {PREVIEW_COST} coins.")
    
    # Check if already in active preview
    active_previews = current_user.active_previews or {}
    if preview.item_id in active_previews:
        expiration = datetime.fromisoformat(active_previews[preview.item_id])
        if expiration > datetime.now(timezone.utc):
            remaining = (expiration - datetime.now(timezone.utc)).total_seconds()
            return {
                "success": True,
                "already_active": True,
                "item": item,
                "expires_at": active_previews[preview.item_id],
                "remaining_seconds": int(remaining)
            }
    
    # Deduct coins and set preview expiration
    expiration = datetime.now(timezone.utc) + timedelta(seconds=PREVIEW_DURATION_SECONDS)
    
    await db.users.update_one(
        {"id": current_user.id},
        {
            "$set": {
                coin_field: user_coins - PREVIEW_COST,
                f"active_previews.{preview.item_id}": expiration.isoformat()
            }
        }
    )
    
    return {
        "success": True,
        "already_active": False,
        "item": item,
        "expires_at": expiration.isoformat(),
        "remaining_seconds": PREVIEW_DURATION_SECONDS,
        "cost_deducted": PREVIEW_COST
    }

@api_router.get("/shop/previews")
async def get_active_previews(current_user: User = Depends(get_current_user)):
    """Get all active previews for the current user"""
    active_previews = current_user.active_previews or {}
    now = datetime.now(timezone.utc)
    
    # Filter out expired previews and calculate remaining time
    valid_previews = []
    expired_ids = []
    
    for item_id, expires_at in active_previews.items():
        expiration = datetime.fromisoformat(expires_at)
        if expiration > now:
            item = await db.shop_items.find_one({"id": item_id}, {"_id": 0})
            if item:
                remaining = (expiration - now).total_seconds()
                valid_previews.append({
                    "item": item,
                    "expires_at": expires_at,
                    "remaining_seconds": int(remaining)
                })
        else:
            expired_ids.append(item_id)
    
    # Clean up expired previews
    if expired_ids:
        await db.users.update_one(
            {"id": current_user.id},
            {"$unset": {f"active_previews.{item_id}": "" for item_id in expired_ids}}
        )
    
    return {"previews": valid_previews}

# Achievement routes
@api_router.get("/achievements")
async def get_achievements(current_user: User = Depends(get_current_user)):
    all_achievements = [
        {"id": "first_activity", "name": "First Steps", "description": "Complete your first activity", "icon": "🎯"},
        {"id": "level_5", "name": "Rising Star", "description": "Reach level 5", "icon": "⭐"},
        {"id": "level_10", "name": "Dedicated", "description": "Reach level 10", "icon": "🏆"},
        {"id": "streak_7", "name": "Week Warrior", "description": "Maintain a 7-day streak", "icon": "🔥"},
        {"id": "streak_30", "name": "Month Master", "description": "Maintain a 30-day streak", "icon": "👑"},
        {"id": "all_sectors", "name": "Renaissance", "description": "Try all sectors", "icon": "🎨"},
        {"id": "rich", "name": "Wealthy", "description": "Earn 1000+ coins", "icon": "💰"},
        {"id": "first_pet", "name": "Pet Owner", "description": "Purchase your first pet", "icon": "🐾"},
        {"id": "music_lover", "name": "Music Lover", "description": "Purchase the music player", "icon": "🎵"},
    ]
    
    return {
        "unlocked": current_user.achievements,
        "all": all_achievements
    }

# Pet interaction endpoint
@api_router.post("/pets/interact")
async def interact_with_pet(pet_data: dict, current_user: User = Depends(get_current_user)):
    """Award XP bonus when user clicks on their pet"""
    pet_id = pet_data.get("pet_id")
    
    if not pet_id:
        raise HTTPException(status_code=400, detail="Pet ID required")
    
    active_previews = current_user.active_previews or {}
    preview_valid = False
    if pet_id in active_previews:
        preview_valid = datetime.fromisoformat(active_previews[pet_id]) > datetime.now(timezone.utc)

    if pet_id not in current_user.pets_owned and not preview_valid:
        raise HTTPException(status_code=400, detail="You don't own this pet")
    
    # Award 5 XP bonus
    bonus_xp = 5
    new_accountable_xp = current_user.accountable_xp + bonus_xp
    new_accountable_level = calculate_level(new_accountable_xp)
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "accountable_xp": new_accountable_xp,
            "accountable_level": new_accountable_level
        }}
    )
    
    return {
        "success": True,
        "xp_awarded": bonus_xp,
        "new_total_xp": new_accountable_xp,
        "new_level": new_accountable_level
    }

# Get user's owned pets with details
@api_router.get("/pets/owned")
async def get_owned_pets(current_user: User = Depends(get_current_user)):
    """Get list of pets owned by user with their details"""
    owned_pets = []
    
    for pet_id in current_user.pets_owned:
        pet_item = await db.shop_items.find_one({"id": pet_id}, {"_id": 0})
        if pet_item:
            owned_pets.append(pet_item)
    
    return {"pets": owned_pets}

# Group routes (keeping existing)
@api_router.post("/groups/create", response_model=Group)
async def create_group(group_data: GroupCreate, current_user: User = Depends(get_current_user)):
    group_id = str(uuid.uuid4())
    group_code = str(uuid.uuid4())[:8].upper()
    
    group_doc = {
        "id": group_id,
        "name": group_data.name,
        "code": group_code,
        "created_by": current_user.id,
        "members": [current_user.id],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.groups.insert_one(group_doc)
    await db.users.update_one({"id": current_user.id}, {"$set": {"group_id": group_id}})
    
    return Group(**group_doc)

@api_router.post("/groups/join")
async def join_group(join_data: GroupJoin, current_user: User = Depends(get_current_user)):
    group = await db.groups.find_one({"code": join_data.code}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if current_user.id in group["members"]:
        return {"success": True, "message": "Already a member"}
    
    await db.groups.update_one(
        {"id": group["id"]},
        {"$push": {"members": current_user.id}}
    )
    await db.users.update_one({"id": current_user.id}, {"$set": {"group_id": group["id"]}})
    
    return {"success": True, "group": group}

@api_router.get("/groups/my-group")
async def get_my_group(current_user: User = Depends(get_current_user)):
    if not current_user.group_id:
        return None
    
    group = await db.groups.find_one({"id": current_user.group_id}, {"_id": 0})
    return group

@api_router.get("/leaderboard/{period}", response_model=List[LeaderboardEntry])
async def get_leaderboard(period: str, current_user: User = Depends(get_current_user)):
    if not current_user.group_id:
        return []
    
    group = await db.groups.find_one({"id": current_user.group_id}, {"_id": 0})
    if not group:
        return []
    
    now = datetime.now(timezone.utc)
    
    if period == "daily":
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "weekly":
        start_time = now - timedelta(days=now.weekday())
        start_time = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "monthly":
        start_time = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_time = datetime.min.replace(tzinfo=timezone.utc)
    
    leaderboard = []
    
    for member_id in group["members"]:
        user = await db.users.find_one({"id": member_id}, {"_id": 0})
        if not user:
            continue
        
        if period == "lifetime":
            xp = user["accountable_xp"]
        else:
            activities = await db.activities.find({
                "user_id": member_id,
                "completed_at": {"$gte": start_time.isoformat()}
            }, {"_id": 0}).to_list(1000)
            xp = sum(activity["xp_earned"] for activity in activities)
        
        leaderboard.append({
            "username": user["username"],
            "xp": xp,
            "level": user["accountable_level"]
        })
    
    leaderboard.sort(key=lambda x: x["xp"], reverse=True)
    return leaderboard

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
