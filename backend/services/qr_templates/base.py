from abc import ABC, abstractmethod


class BaseQRTemplate(ABC):
    template_id: str = ""
    display_name: str = ""
    description: str = ""
    supports_custom_colors: bool = False
    default_color_principal: str = "#1e3a5f"
    default_color_acento: str = "#f5b800"

    @abstractmethod
    async def generate_pdf(self, db, school_id, data, user, limit=None,
                           color_principal: str = None, color_acento: str = None) -> bytes:
        """Generate PDF bytes. color_principal/color_acento used by templates with supports_custom_colors=True."""
        pass
