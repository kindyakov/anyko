"""Normalize legacy Office images in a disposable DOCX copy."""
import io
import posixpath
import struct
from urllib.parse import unquote
import zipfile


LEGACY_EXTENSIONS = {'.wmf', '.emf'}
MAX_MEDIA_BYTES = 16 * 1024 * 1024
SKIPPED_VISUAL = 'Изображение WMF/EMF пропущено: не удалось получить предпросмотр.'
WORD = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
REL_ATTRIBUTES = (REL + 'id', REL + 'embed', REL + 'link')


def image_png(payload):
    from PIL import Image

    try:
        with Image.open(io.BytesIO(payload), formats=['WMF']) as image:
            if image.width * image.height > 25_000_000:
                return None
            if payload.startswith(b'\xd7\xcd\xc6\x9a') and max(image.size) <= 1200:
                image.load(dpi=144)
            image.thumbnail((2400, 2400))
            output = io.BytesIO()
            # The Office extractor retains RGBA as PNG. Avoid a lossy JPEG
            # rendition that would appear as a second image in the export.
            image.convert('RGBA').save(output, format='PNG')
            return output.getvalue()
    except (OSError, ValueError, SyntaxError, ArithmeticError, struct.error, Image.DecompressionBombError):
        return None


def replace_missing_visuals(root, missing_ids, etree):
    replaced = set()
    visuals = {}
    for node in root.iter():
        refs = {node.get(attribute) for attribute in REL_ATTRIBUTES} & missing_ids
        if not refs:
            continue
        visual = node
        parent = visual.getparent()
        while parent is not None and parent.tag != WORD + 'r':
            visual, parent = parent, parent.getparent()
        if parent is not None:
            visuals.setdefault(visual, set()).update(refs)
    for visual, refs in visuals.items():
        marker = etree.Element(WORD + 't')
        marker.text = ' [' + SKIPPED_VISUAL + '] '
        marker.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        visual.getparent().replace(visual, marker)
        replaced.update(refs)
    return replaced


def media_entries(entries, max_images):
    media = [entry for entry in entries
             if entry.filename.startswith('word/media/') and not entry.is_dir()]
    if len(media) > max_images:
        raise ValueError('TOO_MANY_EXPORTED_IMAGES')
    if sum(entry.file_size for entry in media) > MAX_MEDIA_BYTES:
        raise ValueError('DOCUMENT_VISUALS_TOO_LARGE')
    return media


def prepare_docx(data, max_images):
    """Return the processing copy and the count of warnings without an inline position."""
    from lxml import etree

    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        entries = source.infolist()
        media = media_entries(entries, max_images)
        legacy = [
            entry for entry in media
            if posixpath.splitext(entry.filename)[1].lower() in LEGACY_EXTENSIONS
        ]
        if not legacy:
            return data, 0
        names = set(source.namelist())
        if (len(entries) >= 2048 or len(names) != len(entries)
                or sum(entry.file_size for entry in entries) > 100 * 1024 * 1024
                or any(entry.file_size > 32 * 1024 * 1024 for entry in entries)):
            raise ValueError('DOCUMENT_VISUALS_TOO_LARGE')
        replacements, updated = {}, {}
        available = MAX_MEDIA_BYTES - sum(
            entry.file_size for entry in media if entry not in legacy
        )
        for index, entry in enumerate(legacy):
            png = image_png(source.read(entry))
            if png is None or len(png) > available:
                replacements[entry.filename] = None
                continue
            target = f'word/media/anyko-legacy-{index}.png'
            while target in names:
                target = target.removesuffix('.png') + '-converted.png'
            replacements[entry.filename] = target
            updated[target] = png
            available -= len(png)

        parser = etree.XMLParser(resolve_entities=False, no_network=True)

        def xml(part):
            return etree.fromstring(source.read(part), parser=parser)

        unplaced = 0
        for part in source.namelist():
            folder, name = posixpath.split(part)
            if posixpath.basename(folder) != '_rels' or not name.endswith('.rels'):
                continue
            parent = posixpath.dirname(folder)
            root = xml(part)
            changed, missing = False, set()
            for relation in list(root):
                target = relation.get('Target')
                if (not target or relation.get('TargetMode') == 'External'
                        or not relation.get('Type', '').endswith('/image')):
                    continue
                value = unquote(target)
                path = posixpath.normpath(value.lstrip('/') if value.startswith('/') else posixpath.join(parent, value))
                if path not in replacements:
                    continue
                replacement = replacements[path]
                if replacement:
                    relation.set('Target', posixpath.relpath(replacement, parent or '.'))
                else:
                    missing.add(relation.get('Id'))
                    root.remove(relation)
                changed = True
            if changed:
                updated[part] = etree.tostring(root)
            if missing:
                owner = posixpath.join(parent, name.removesuffix('.rels'))
                if owner in names:
                    owner_root = xml(owner)
                    placed = replace_missing_visuals(owner_root, missing, etree)
                    unplaced += len(missing - placed)
                    if placed:
                        updated[owner] = etree.tostring(owner_root)
                else:
                    unplaced += len(missing)

        if any(replacements.values()):
            part = '[Content_Types].xml'
            root = xml(part)
            if not any(child.get('Extension', '').lower() == 'png' for child in root):
                etree.SubElement(root, root.tag.replace('Types', 'Default'),
                                 Extension='png', ContentType='image/png')
                updated[part] = etree.tostring(root)

        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as copy:
            for entry in entries:
                if entry.filename in replacements:
                    continue
                payload = updated.pop(entry.filename, None)
                copy.writestr(entry.filename, source.read(entry) if payload is None else payload)
            for part, payload in updated.items():
                copy.writestr(part, payload)
    return output.getvalue(), unplaced
