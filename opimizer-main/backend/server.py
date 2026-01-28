from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Optional, Any
import uuid
from datetime import datetime, timezone
import asyncio

# Import services
from services.data_fetcher import DataFetcher
from services.enhanced_data_fetcher import enhanced_data_fetcher
from services.ml_trainer import MLTrainer
from services.optimizer import PortfolioOptimizer
from services.backtester import Backtester

# Import auth routes
from routes.auth import router as auth_router
from routes.kyc import router as kyc_router
from routes.portfolio import router as portfolio_router
from routes.portfolios import router as portfolios_router
from routes.alerts import router as alerts_router
from routes.brokers import router as brokers_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize services
data_fetcher = DataFetcher()
ml_trainer = MLTrainer()
optimizer = PortfolioOptimizer()
backtester = Backtester()

# Training status storage
training_status = {}

# Define Models
class AssetSearch(BaseModel):
    query: str
    asset_type: str  # 'stock' or 'crypto'

class DataFetchRequest(BaseModel):
    symbols: List[str]
    asset_type: str
    start_date: str
    end_date: str

class ModelTrainRequest(BaseModel):
    symbols: List[str]
    asset_type: str
    start_date: str
    end_date: str

class OptimizationRequest(BaseModel):
    symbols: List[str]
    asset_type: str
    risk_tolerance: float = 0.5
    start_date: str
    end_date: str
    rebalance_freq: str = 'daily'  # 'daily', 'weekly', 'on-demand'

class BacktestRequest(BaseModel):
    symbols: List[str]
    asset_type: str
    weights: Dict[str, float]
    start_date: str
    end_date: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "Portfolio Optimizer API"}

@api_router.post("/assets/search")
async def search_assets(request: AssetSearch):
    try:
        results = await enhanced_data_fetcher.search_assets(
            request.query,
            request.asset_type if request.asset_type != 'both' else None
        )
        return {"assets": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/assets/popular/{asset_type}")
async def get_popular_assets(asset_type: str):
    try:
        results = await enhanced_data_fetcher.get_popular_examples(asset_type, limit=10)
        return {"assets": results}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/assets/price/{symbol}")
async def get_real_time_price(symbol: str, asset_type: str = 'stock'):
    try:
        price_data = await enhanced_data_fetcher.fetch_real_time_price(symbol, asset_type)
        if price_data:
            return price_data
        else:
            raise HTTPException(status_code=404, detail="Price data not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/data/fetch")
async def fetch_data(request: DataFetchRequest):
    try:
        data = await data_fetcher.fetch_historical_data(
            request.symbols,
            request.asset_type,
            request.start_date,
            request.end_date
        )
        return {"data": data, "symbols": request.symbols}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/models/train")
async def train_models(request: ModelTrainRequest, background_tasks: BackgroundTasks):
    try:
        task_id = str(uuid.uuid4())
        training_status[task_id] = {
            "status": "starting",
            "progress": 0,
            "current_model": None,
            "results": None
        }
        
        # Start training in background
        background_tasks.add_task(
            train_models_background,
            task_id,
            request.symbols,
            request.asset_type,
            request.start_date,
            request.end_date
        )
        
        return {"task_id": task_id, "status": "started"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/models/status/{task_id}")
async def get_training_status(task_id: str):
    if task_id not in training_status:
        raise HTTPException(status_code=404, detail="Task not found")
    return training_status[task_id]

@api_router.post("/optimize")
async def optimize_portfolio(request: OptimizationRequest):
    try:
        result = await optimizer.optimize(
            request.symbols,
            request.asset_type,
            request.start_date,
            request.end_date,
            request.risk_tolerance
        )
        
        # Save to database
        doc = {
            "id": str(uuid.uuid4()),
            "symbols": request.symbols,
            "asset_type": request.asset_type,
            "weights": result["weights"],
            "expected_return": result["expected_return"],
            "risk": result["risk"],
            "sharpe_ratio": result["sharpe_ratio"],
            "rebalance_freq": request.rebalance_freq,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.optimization_history.insert_one(doc)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/backtest")
async def run_backtest(request: BacktestRequest):
    try:
        result = await backtester.run_backtest(
            request.symbols,
            request.asset_type,
            request.weights,
            request.start_date,
            request.end_date
        )
        
        # Save to database
        doc = {
            "id": str(uuid.uuid4()),
            "symbols": request.symbols,
            "weights": request.weights,
            "metrics": result,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.backtest_results.insert_one(doc)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/portfolio/history")
async def get_portfolio_history():
    try:
        history = await db.optimization_history.find({}, {"_id": 0}).sort("timestamp", -1).limit(10).to_list(10)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def train_models_background(task_id: str, symbols: List[str], asset_type: str, start_date: str, end_date: str):
    try:
        training_status[task_id]["status"] = "training"
        
        results = await ml_trainer.train_all_models(
            symbols,
            asset_type,
            start_date,
            end_date,
            lambda progress, model: update_training_progress(task_id, progress, model)
        )
        
        training_status[task_id]["status"] = "completed"
        training_status[task_id]["progress"] = 100
        training_status[task_id]["results"] = results
        
        # Save to database
        doc = {
            "id": task_id,
            "symbols": symbols,
            "asset_type": asset_type,
            "results": results,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.model_results.insert_one(doc)
        
    except Exception as e:
        training_status[task_id]["status"] = "failed"
        training_status[task_id]["error"] = str(e)

def update_training_progress(task_id: str, progress: int, model: str):
    training_status[task_id]["progress"] = progress
    training_status[task_id]["current_model"] = model

# Include the router in the main app
app.include_router(api_router)
app.include_router(auth_router)
app.include_router(kyc_router)
app.include_router(portfolio_router)
app.include_router(portfolios_router)
app.include_router(alerts_router)
app.include_router(brokers_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
