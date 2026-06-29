from fastapi import APIRouter
from pydantic import BaseModel
from services.data_loader import load_data
from services.forecast_engine import forecast_labor, forecast_aws
from services.ai_engine import generate_rule_based_insights

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.get("/insights")
def get_insights():
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    aws_df = forecast_aws(aws_raw)
    insights = generate_rule_based_insights(labor_df, aws_df)
    return {"insights": insights, "stream": False}


@router.post("/chat")
def chat(req: ChatRequest):
    try:
        from services.rag_agent import get_agent_response
        roster, project, eta, aws_raw = load_data()
        dfs = [roster, eta, project, aws_raw]

        # Build alerts context
        labor_df = forecast_labor(eta, roster, project)
        aws_df = forecast_aws(aws_raw)
        insights = generate_rule_based_insights(labor_df, aws_df)
        alerts_context = "\n".join(f"[{i['severity']}] {i['title']}: {i['message']}" for i in insights)

        response = get_agent_response(req.message, dfs, req.history, alerts_context)
        return {"response": response, "stream": False}
    except Exception as e:
        return {"response": f"⚠️ Error: {e}", "stream": False}
