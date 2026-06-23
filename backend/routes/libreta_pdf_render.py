"""
libreta_pdf_render.py — Render fiel de libretas a PDF usando Chromium headless
(Playwright), para la descarga MASIVA (ZIP).

Por qué existe:
  La impresión INDIVIDUAL usa el motor de impresión nativo del navegador
  (react-to-print) y sale perfecta. La descarga masiva usaba html2canvas, que
  deforma la tabla (texto pegado a los bordes). Aquí reusamos EXACTAMENTE el
  mismo HTML renderizado de <LibretaCard> + el MISMO archivo LibretaCard.css
  (incluido @media print) y dejamos que Chromium imprima a PDF → salida
  idéntica al botón "Imprimir".

Garantía en producción:
  `playwright` se declara en requirements.txt (persiste en deploy). El binario
  de Chromium NO es un artefacto pip: lo aseguramos en runtime ejecutando
  `playwright install chromium` la primera vez si no está disponible. Así no
  dependemos de /usr/bin/chromium (instalación manual que NO persiste).

Memoria en lote:
  Un único navegador persistente + Semaphore(1) → se procesa una libreta a la
  vez (una página que se cierra y libera memoria). Nunca en paralelo masivo.
"""
import asyncio
import logging
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel

from .core import get_current_user

logger = logging.getLogger("server")
router = APIRouter(tags=["libreta_pdf_render"])

# Ruta al MISMO CSS que usa la libreta en el frontend (única fuente de verdad).
CSS_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "components" / "libreta" / "LibretaCard.css"
)

_PAPER_MAP = {"a4": "A4", "letter": "letter", "legal": "legal"}

# --- Ciclo de vida del navegador (singleton) ---
_pw = None
_browser = None
_launch_lock = asyncio.Lock()
_render_sem = asyncio.Semaphore(1)
_browser_installed = False


def _install_chromium_blocking():
    """Descarga el navegador de Playwright si falta. Idempotente."""
    logger.info("[libreta-pdf] Instalando Chromium de Playwright (runtime)...")
    subprocess.run(
        [sys.executable, "-m", "playwright", "install", "chromium"],
        check=True,
        timeout=600,
    )
    logger.info("[libreta-pdf] Chromium instalado.")


async def _get_browser():
    """Devuelve un navegador Chromium listo; lo instala/lanza si hace falta."""
    global _pw, _browser, _browser_installed
    async with _launch_lock:
        if _browser is not None and _browser.is_connected():
            return _browser
        from playwright.async_api import async_playwright
        if _pw is None:
            _pw = await async_playwright().start()
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        try:
            _browser = await _pw.chromium.launch(args=launch_args)
        except Exception as e:
            if _browser_installed:
                raise
            # El navegador probablemente no está instalado: lo instalamos y reintentamos UNA vez.
            logger.warning("[libreta-pdf] Chromium no disponible (%s). Instalando...", e)
            await asyncio.get_event_loop().run_in_executor(None, _install_chromium_blocking)
            _browser_installed = True
            _browser = await _pw.chromium.launch(args=launch_args)
        return _browser


class RenderPdfBody(BaseModel):
    html: str                       # outerHTML de la .libreta-card ya renderizada
    paper_size: str = "a4"
    orientation: str = "portrait"
    fit_one_page: bool = False


@router.post("/api/report-cards/render-pdf")
async def render_libreta_pdf(body: RenderPdfBody, current_user=Depends(get_current_user)):
    if not CSS_PATH.exists():
        logger.error("[libreta-pdf] No se encontró el CSS de la libreta en %s", CSS_PATH)
        raise HTTPException(status_code=500, detail="No se encontró el CSS de la libreta para generar el PDF")

    css = CSS_PATH.read_text(encoding="utf-8")
    paper = _PAPER_MAP.get((body.paper_size or "a4").lower(), "A4")
    orient = "portrait" if body.fit_one_page else (body.orientation or "portrait")
    page_rule = f"@page {{ size: {paper} {orient}; margin: 0.8cm; }}"

    # Documento idéntico al de la impresión individual: el wrapper .libreta-printable
    # activa las reglas @media print del MISMO CSS.
    doc = (
        "<!doctype html><html><head><meta charset=\"utf-8\">"
        f"<style>{css}</style><style>{page_rule}</style></head>"
        f"<body><div class=\"libreta-printable\">{body.html}</div></body></html>"
    )

    try:
        browser = await _get_browser()
    except Exception as e:
        logger.exception("[libreta-pdf] No se pudo iniciar Chromium")
        raise HTTPException(status_code=503, detail="No se pudo iniciar el generador de PDF (Chromium). Intenta nuevamente.")

    async with _render_sem:
        page = await browser.new_page()
        try:
            await page.set_content(doc, wait_until="load", timeout=30000)
            # Pequeña espera para que carguen imágenes remotas (logo/foto/firma).
            await page.wait_for_timeout(700)
            pdf_bytes = await page.pdf(
                prefer_css_page_size=True,
                print_background=True,
            )
        except Exception as e:
            logger.exception("[libreta-pdf] Falló el render del PDF")
            raise HTTPException(status_code=500, detail="No se pudo renderizar la libreta a PDF")
        finally:
            await page.close()

    return Response(content=pdf_bytes, media_type="application/pdf")
