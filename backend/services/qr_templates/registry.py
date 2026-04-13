from .classic import ClassicTemplate
from .moderna import ModernaTemplate

AVAILABLE_TEMPLATES = {
    "classic": ClassicTemplate(),
    "moderna": ModernaTemplate(),
}
DEFAULT_TEMPLATE = "classic"


def get_template(template_id: str):
    return AVAILABLE_TEMPLATES.get(template_id, AVAILABLE_TEMPLATES[DEFAULT_TEMPLATE])


def list_templates():
    return [
        {
            "id": t.template_id, "name": t.display_name, "description": t.description,
            "supports_custom_colors": t.supports_custom_colors,
            "default_color_principal": t.default_color_principal,
            "default_color_acento": t.default_color_acento,
        }
        for t in AVAILABLE_TEMPLATES.values()
    ]
