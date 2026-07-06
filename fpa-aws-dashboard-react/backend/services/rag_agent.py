"""RAG agent using LangChain Pandas agent with Azure OpenAI."""
import os
import httpx
import pandas as pd
import matplotlib
matplotlib.use('Agg')  # Prevent GUI backend - suppress the threading warning

from langchain_openai import AzureChatOpenAI
from langchain_experimental.agents.agent_toolkits import create_pandas_dataframe_agent

_http_client = httpx.Client(verify=False)
_llm_instance = None


def get_llm():
    global _llm_instance
    if _llm_instance is None:
        _llm_instance = AzureChatOpenAI(
            azure_deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini"),
            azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", ""),
            api_key=os.environ.get("AZURE_OPENAI_API_KEY", ""),
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
            http_client=_http_client,
            temperature=1,
        )
    return _llm_instance


SYSTEM_PREFIX = """You are a financial planning analyst for a Spectrum business unit.
You have access to 4 pandas DataFrames:

df1 (roster): Employee ID, Employee Name, Title, Type, Hourly Rate, Company, Location, Supervisor 2, Supervisor 3, Supervisor 4
df2 (time_allocation): Employee ID, Employee Name, Project Number, Project Name, Jan-Dec (hours), Full Year
df3 (project_list): Project Number, Project Name, Investment Category, Accounting Classification, Funding Business Unit, Asset Type
df4 (aws_model): Account Number, Employee ID, Employee Name, Jan-Dec (dollar costs), Full Year

When answering, generate and execute pandas code against these dataframes.
Provide clear, concise answers suitable for business stakeholders.

IMPORTANT RULES FOR CHARTS:
- Do NOT use matplotlib or plt.show(). They will fail in this environment.
- Instead, when a chart is requested, use plotly to create figures and call fig.to_json() to get the JSON string.
- Include the Plotly JSON string in your final answer wrapped between [PLOTLY_CHART] and [/PLOTLY_CHART] markers.
- Example: compute data with pandas, then create a plotly figure and output its JSON.
- You have plotly available: import plotly.express as px or import plotly.graph_objects as go
"""

# Formatting instructions appended to the user query (not the prefix)
FORMAT_INSTRUCTIONS = """

When presenting your final answer, please follow these formatting rules:
- Format your response as markdown
- Use **bold** for KPI values, dollar amounts, percentages, and key metrics
- When presenting tabular data (3+ rows), use markdown tables with | column | separators
- Keep responses concise: max 3-4 short paragraphs, prefer bullet points
- Start with a brief executive summary (1-2 sentences)
- Highlight key insights with > blockquotes
- For charts: use plotly (not matplotlib), call fig.to_json(), and wrap the output between [PLOTLY_CHART] and [/PLOTLY_CHART] markers in your final answer
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

    # Append formatting instructions to the user query
    full_query = f"{history_text}\nUser: {query}{FORMAT_INSTRUCTIONS}" if history_text else f"{query}{FORMAT_INSTRUCTIONS}"

    agent = create_pandas_dataframe_agent(
        get_llm(),
        dfs,
        agent_type="tool-calling",
        verbose=False,
        allow_dangerous_code=True,
        prefix=prefix,
    )

    result = agent.invoke({"input": full_query})
    return result["output"]
