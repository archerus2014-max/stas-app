from typing import Dict, List, Optional

from .models import SportAvailability


class LangepasService:
    """Работа с локальной базой спортивной доступности Лангепаса."""

    ACTIVE_STATUSES = {"active", "seasonal"}

    def __init__(self, availability: Optional[List[SportAvailability]] = None):
        self.availability = availability or []
        self._by_sport: Dict[str, SportAvailability] = {
            item.sport_id: item for item in self.availability
        }

    def get(self, sport_id: str) -> Optional[SportAvailability]:
        return self._by_sport.get(sport_id)

    def is_available(self, sport_id: str) -> bool:
        item = self.get(sport_id)
        return item is not None and item.status in self.ACTIVE_STATUSES

    def available_sports(self) -> List[SportAvailability]:
        return [
            item
            for item in self.availability
            if item.status in self.ACTIVE_STATUSES
        ]

    def seasonal_sports(self) -> List[SportAvailability]:
        return [
            item
            for item in self.availability
            if item.status == "seasonal"
        ]

    def event_only_sports(self) -> List[SportAvailability]:
        return [
            item
            for item in self.availability
            if item.status == "event"
        ]

    def find_by_name(self, query: str) -> List[SportAvailability]:
        """Поиск по названию спорта без изменения исходных данных."""
        query = query.strip().lower()

        if not query:
            return []

        return [
            item
            for item in self.availability
            if query in item.name.lower()
        ]

    def describe(self, sport_id: str) -> Dict[str, object]:
        """Подготовить данные о доступности конкретного спорта."""
        item = self.get(sport_id)

        if item is None:
            return {
                "sport_id": sport_id,
                "status": "unknown",
                "available": False,
                "message": "В локальной базе нет подтверждённых данных.",
            }

        available = item.status in self.ACTIVE_STATUSES

        if item.status == "active":
            message = "Направление подтверждено как доступное."
        elif item.status == "seasonal":
            message = "Направление доступно сезонно."
        elif item.status == "event":
            message = (
                "Подтверждено мероприятие, но постоянная секция "
                "не подтверждена."
            )
        elif item.status == "closed":
            message = "Направление отмечено как закрытое."
        else:
            message = "Статус требует дополнительной проверки."

        return {
            "sport_id": item.sport_id,
            "name": item.name,
            "status": item.status,
            "available": available,
            "organization_or_object": item.organization_or_object,
            "address": item.address,
            "age_groups": item.age_groups,
            "training_confirmed": item.training_confirmed,
            "source": item.source,
            "source_url": item.source_url,
            "checked_at": item.checked_at,
            "notes": item.notes,
            "message": message,
        }
