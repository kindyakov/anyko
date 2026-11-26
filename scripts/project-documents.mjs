import path from 'node:path';

function markdownWithoutFences(content) {
  return content.replace(
    /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*\r?$/gm,
    '\n',
  );
}

export function localMarkdownLinks(file, content) {
  const links = [];
  for (const match of markdownWithoutFences(content).matchAll(
    /\[[^\]]+\]\((<[^>]+>|[^)]+)\)/g,
  )) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    const [pathname, fragment] = target.split('#', 2);
    links.push({
      target,
      file: pathname
        ? path.resolve(path.dirname(file), decodeURIComponent(pathname))
        : file,
      anchor: fragment ? decodeURIComponent(fragment) : '',
    });
  }
  return links;
}

function headingSlugs(content) {
  const headings = markdownWithoutFences(content).matchAll(
    /^ {0,3}#{1,6}[ \t]+(.+)$|^ {0,3}(\S[^\r\n]*)\r?\n {0,3}(?:=+|-+)[ \t]*$/gm,
  );
  const slugs = new Set();
  for (const match of headings) {
    const slug = (match[1] ?? match[2])
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    let unique = slug;
    for (let suffix = 1; slugs.has(unique); suffix++) {
      unique = `${slug}-${suffix}`;
    }
    slugs.add(unique);
  }
  return slugs;
}

export function architectureDocumentErrors(
  root,
  architectureFiles,
  anchorSources,
  markdown,
) {
  const errors = [];
  const relative = (file) =>
    path.relative(root, file).split(path.sep).join('/');
  const agents = path.join(root, 'AGENTS.md');
  const registered = new Set(
    localMarkdownLinks(agents, markdown.get(agents)).map((link) => link.file),
  );
  for (const file of architectureFiles) {
    if (!markdown.has(file) || !registered.has(file)) {
      errors.push(
        `создайте ${relative(file)} и добавьте ссылку в таблицу AGENTS.md`,
      );
    }
  }

  for (const file of anchorSources) {
    for (const link of localMarkdownLinks(file, markdown.get(file))) {
      const target = markdown.get(link.file);
      if (
        link.anchor &&
        target !== undefined &&
        !headingSlugs(target).has(link.anchor)
      ) {
        errors.push(
          `${relative(file)}: исправьте якорь в ссылке ${link.target}`,
        );
      }
    }
  }
  return errors;
}
