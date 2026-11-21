"""On-the-fly image resizing and modern formats: hero.jpg?w=800&format=webp"""

import io

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 60_000_000  # refuse "decompression bombs"

RESIZABLE = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/bmp", "image/tiff"}
FORMATS = {"webp": ("WEBP", "image/webp"), "avif": ("AVIF", "image/avif"), "jpeg": ("JPEG", "image/jpeg"),
           "jpg": ("JPEG", "image/jpeg"), "png": ("PNG", "image/png")}
MAX_SIDE = 4096
STEP = 50  # widths/heights are rounded up to steps so caches stay small


class TransformError(ValueError):
    pass


def parse_options(params, accept: str, source_mime: str) -> dict | None:
    """Returns normalized options, or None when the original should be served."""
    wanted = {k: params.get(k) for k in ("w", "h", "fit", "format", "q") if params.get(k)}
    if not wanted or source_mime not in RESIZABLE:
        return None

    def side(name):
        if name not in wanted:
            return 0
        try:
            v = int(wanted[name])
        except ValueError:
            raise TransformError(f"'{name}' must be a number of pixels")
        if not 1 <= v <= MAX_SIDE:
            raise TransformError(f"'{name}' must be between 1 and {MAX_SIDE}")
        return min(MAX_SIDE, ((v + STEP - 1) // STEP) * STEP)

    fmt = (wanted.get("format") or "").lower()
    if fmt == "auto" or not fmt:
        fmt = "avif" if "image/avif" in accept else ("webp" if "image/webp" in accept else "")
    if fmt and fmt not in FORMATS:
        raise TransformError("format must be webp, avif, jpeg, png or auto")
    fit = (wanted.get("fit") or "cover").lower()
    if fit not in ("cover", "contain", "inside"):
        raise TransformError("fit must be cover, contain or inside")
    try:
        q = int(wanted.get("q") or 80)
    except ValueError:
        raise TransformError("q must be a number from 30 to 95")
    q = max(30, min(95, (q // 5) * 5))
    return {"w": side("w"), "h": side("h"), "fit": fit, "format": fmt, "q": q}


def variant_name(opts: dict, source_mime: str) -> str:
    fmt = opts["format"] or {"image/png": "png", "image/webp": "webp", "image/avif": "avif"}.get(source_mime, "jpeg")
    return f"v_{opts['w']}x{opts['h']}_{opts['fit']}_q{opts['q']}.{fmt}"


def transform(data: bytes, opts: dict, source_mime: str) -> tuple[bytes, str]:
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # respect phone photo rotation
    except Image.DecompressionBombError:
        raise TransformError("image is too large to resize")
    except Exception:
        raise TransformError("this file isn't a readable image")

    w, h = opts["w"], opts["h"]
    if w or h:
        if w and h and opts["fit"] == "cover":
            img = ImageOps.fit(img, (w, h), Image.Resampling.LANCZOS)
        else:
            target = (w or 10**6, h or 10**6)
            if img.width > target[0] or img.height > target[1]:
                img.thumbnail(target, Image.Resampling.LANCZOS)  # never upscale
            if opts["fit"] == "contain" and w and h:
                canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2))
                img = canvas

    fmt_key = opts["format"] or {"image/png": "png", "image/webp": "webp", "image/avif": "avif"}.get(source_mime, "jpeg")
    pil_fmt, mime = FORMATS[fmt_key]
    if pil_fmt == "JPEG" and img.mode not in ("RGB", "L"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1])
        img = background
    out = io.BytesIO()
    save_args = {"quality": opts["q"]}
    if pil_fmt == "JPEG":
        save_args.update(optimize=True, progressive=True)
    if pil_fmt == "PNG":
        save_args = {"optimize": True}
    img.save(out, pil_fmt, **save_args)
    return out.getvalue(), mime
