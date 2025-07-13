from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

# Placeholder for actual scraping logic
# from scraper import scrape_agencies

def scrape_agencies(queries, max_pages=1, max_items_per_page=3):
    # TODO: Replace with real Selenium scraping logic
    # This is a dummy response for demonstration
    results = []
    for q in queries:
        results.append({
            "business": q.business,
            "category": q.category,
            "max_pages": max_pages,
            "max_items_per_page": max_items_per_page,
            "data": "scraped data here"
        })
    return results

app = FastAPI()

class Query(BaseModel):
    business: str
    category: str

class ScrapeRequest(BaseModel):
    queries: List[Query]
    max_pages: Optional[int] = 1
    max_items_per_page: Optional[int] = 3

@app.post("/scrape")
def scrape_endpoint(request: ScrapeRequest):
    if not request.queries:
        raise HTTPException(status_code=400, detail="Missing or invalid queries array")
    try:
        max_pages = request.max_pages if request.max_pages is not None else 1
        max_items_per_page = request.max_items_per_page if request.max_items_per_page is not None else 3
        results = scrape_agencies(
            request.queries,
            max_pages=max_pages,
            max_items_per_page=max_items_per_page
        )
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("fastapi_server:app", host="0.0.0.0", port=3000, reload=True) 