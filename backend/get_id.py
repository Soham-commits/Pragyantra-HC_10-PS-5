import asyncio
from app.database import connect_to_mongo, close_mongo_connection, get_specialists_collection

async def run():
    await connect_to_mongo()
    col = get_specialists_collection()
    res = await col.find_one({"name": "Dr. Kavita Rao"})
    if res:
        print("FOUND", res["specialist_id"])
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(run())
