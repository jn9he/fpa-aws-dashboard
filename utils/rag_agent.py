"""RAG agent using LangChain Pandas agent with Azure OpenAI."""
import os
import httpx
import pandas as pd
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent

load_dotenv()

_http_client = httpx.Client(verify=False)

_llm = AzureChatOpenAI(
    azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini"),
    azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
    api_key=os.environ.get("AZURE_OPENAI_API_KEY", ""),
    api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
    http_client=_http_client,
    temperature=1,
)

SYSTEM_PREFIX = """You are a financial planning analyst for a Spectrum business unit.
You have access to 4 pandas DataFrames:

df1 (roster): Employee ID, Employee Name, Title, Type, Hourly Rate, Company, Location, Supervisor 2, Supervisor 3, Supervisor 4
df2 (time_allocation): Employee ID, Employee Name, Project Number, Project Name, Jan-Dec (hours), Full Year
df3 (project_list): Project Number, Project Name, Investment Category, Accounting Classification, Funding Business Unit, Asset Type
df4 (aws_model): Account Number, Employee ID, Employee Name, Jan-Dec (dollar costs), Full Year

When answering, generate and execute pandas code against these dataframes.
Provide clear, concise answers suitable for business stakeholders.
"""


def get_agent_response(query: str, dfs: list, chat_history: list, alerts_context: str = "") -> str:
    """Invoke the pandas agent with conversation context."""
    prefix = SYSTEM_PREFIX
    if alerts_context:
        prefix += f"\nActive alerts from rule-based analysis:\n{alerts_context}\n"

    # Build context from chat history
    history_text = ""
    if chat_history:
        recent = chat_history[-6:]  # last 3 exchanges
        history_text = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in recent
        )

    full_query = f"{history_text}\nUser: {query}" if history_text else query

    agent = create_pandas_dataframe_agent(
        _llm,
        dfs,
        agent_type="tool-calling",
        verbose=False,
        allow_dangerous_code=True,
        prefix=prefix,
    )

    result = agent.invoke({"input": full_query})
    return result["output"]
