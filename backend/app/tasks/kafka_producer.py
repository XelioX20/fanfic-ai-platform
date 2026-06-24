import json
import logging
from aiokafka import AIOKafkaProducer
from app.core.config import settings

logger = logging.getLogger(__name__)
_producer = None


async def get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        await _producer.start()
    return _producer


async def send_event(topic: str, event: dict) -> None:
    try:
        producer = await get_producer()
        await producer.send_and_wait(topic, event)
    except Exception as e:
        logger.error(f"Failed to send Kafka event to {topic}: {e}")


async def send_fanfic_scraped(fanfic_data: dict) -> None:
    await send_event("fanfic.scraped", fanfic_data)


async def send_interaction_recorded(user_id: str, fanfic_id: str, interaction_type: str) -> None:
    await send_event("user.interaction", {
        "user_id": user_id, "fanfic_id": fanfic_id, "interaction_type": interaction_type,
    })


async def send_analyze_request(fanfic_id: str, text: str) -> None:
    await send_event("fanfic.analyze", {"fanfic_id": fanfic_id, "text": text})
