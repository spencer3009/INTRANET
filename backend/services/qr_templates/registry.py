from .classic import ClassicTemplate

AVAILABLE_TEMPLATES = {"classic": ClassicTemplate()}
DEFAULT_TEMPLATE = "classic"


def get_template(template_id: str):
    return AVAILABLE_TEMPLATES.get(template_id, AVAILABLE_TEMPLATES[DEFAULT_TEMPLATE])


def list_templates():
    return [
        {"id": t.template_id, "name": t.display_name, "description": t.description}
        for t in AVAILABLE_TEMPLATES.values()
    ]
