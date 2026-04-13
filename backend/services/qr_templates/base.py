from abc import ABC, abstractmethod


class BaseQRTemplate(ABC):
    template_id: str = ""
    display_name: str = ""
    description: str = ""

    @abstractmethod
    async def generate_pdf(self, db, school_id, data, user) -> bytes:
        """Generate PDF bytes for the given students filter."""
        pass
